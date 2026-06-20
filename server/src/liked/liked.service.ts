import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';

type ToggleRow = { added: boolean; movieId: string[]; seriesId: string[] };

@Injectable()
export class LikedService {
  constructor(private prisma: PrismaService) {}

  private async ensureLikedList(userId: string) {
    try {
      return await this.prisma.likedList.upsert({
        where: { userId },
        update: {},
        create: {
          user: { connect: { id: userId } },
          movieId: [],
          seriesId: [],
        },
      });
    } catch (e) {
      // Two concurrent first-time ensures can race the upsert to a P2002;
      // the row exists now, so just read it back.
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.likedList.findUnique({ where: { userId } });
        if (existing) return existing;
      }
      throw e;
    }
  }

  /**
   * Get liked list. Read-only — never creates a row. Creating on read meant every
   * concurrent reader (common right after login) raced to INSERT the same row,
   * producing a P2002 unique-constraint error per loser. The row is created lazily
   * on the first write (toggle/remove both call ensureLikedList first).
   */
  async getAll(userId: string) {
    const likedList = await this.prisma.likedList.findUnique({ where: { userId } });
    return likedList ?? { userId, movieId: [], seriesId: [] };
  }

  async toggle(userId: string, tmdbId: string, type: Kind) {
    await this.ensureLikedList(userId);

    const field = type === 'movie' ? 'movieId' : 'seriesId';
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const numericId = Number(tmdbId);

    return this.prisma.$transaction(async (tx) => {
      // Add-or-remove happens inside the DB under a row lock, so concurrent
      // toggles serialize on the row and can't lose updates. RETURNING reports
      // the post-update state, so `added` is the real transition — not a stale read.
      const rows = await tx.$queryRawUnsafe<ToggleRow[]>(
        `UPDATE "LikedList"
            SET "${field}" = CASE WHEN $1 = ANY("${field}")
                                  THEN array_remove("${field}", $1)
                                  ELSE array_append("${field}", $1) END
          WHERE "userId" = $2
          RETURNING ($1 = ANY("${field}")) AS "added", "movieId", "seriesId"`,
        tmdbId,
        userId,
      );

      const row = rows[0];
      const added = !!row?.added;

      // Counter delta matches the actual DB transition, so it can't drift.
      await tx.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId: numericId, mediaType } },
        create: { tmdbId: numericId, mediaType, likeCount: added ? 1 : 0 },
        update: { likeCount: { increment: added ? 1 : -1 } },
      });

      return {
        liked: added,
        totalMovies: row?.movieId.length ?? 0,
        totalSeries: row?.seriesId.length ?? 0,
      };
    });
  }

  async remove(userId: string, type: 'movie' | 'tv', tmdbId: number) {
    await this.ensureLikedList(userId);

    const field = type === 'movie' ? 'movieId' : 'seriesId';
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const idStr = String(tmdbId);
    const label = type === 'movie' ? 'Movie' : 'Series';

    return this.prisma.$transaction(async (tx) => {
      // Only updates (and only returns a row) when the id was actually present,
      // so the counter is decremented exactly once and never for a no-op.
      const rows = await tx.$queryRawUnsafe<{ userId: string }[]>(
        `UPDATE "LikedList"
            SET "${field}" = array_remove("${field}", $1)
          WHERE "userId" = $2 AND $1 = ANY("${field}")
          RETURNING "userId"`,
        idStr,
        userId,
      );

      if (rows.length === 0) {
        return { message: `${label} ${tmdbId} was not liked` };
      }

      await tx.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId, mediaType } },
        create: { tmdbId, mediaType, likeCount: 0 },
        update: { likeCount: { decrement: 1 } },
      });

      return { message: `${label} ${tmdbId} removed from liked` };
    });
  }
}
