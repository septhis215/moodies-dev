import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';
type Field = 'movieId' | 'seriesId';

type ToggleRow = { added: boolean; movieId: string[]; seriesId: string[] };

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) { }

  /** Ensure the user has exactly one watchlist row (upsert avoids a find→create race). */
  private async ensureWatchlist(userId: string) {
    try {
      return await this.prisma.watchlist.upsert({
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
        const existing = await this.prisma.watchlist.findUnique({ where: { userId } });
        if (existing) return existing;
      }
      throw e;
    }
  }

  /**
   * Get watchlist. Read-only — never creates a row. Creating on read meant every
   * concurrent reader (common right after login) raced to INSERT the same row,
   * producing a P2002 unique-constraint error per loser. The row is created lazily
   * on the first write (toggle/remove/clear all call ensureWatchlist first).
   */
  async getAll(userId: string) {
    const watchlist = await this.prisma.watchlist.findUnique({ where: { userId } });
    return watchlist ?? { userId, movieId: [], seriesId: [] };
  }

  /** Toggle add/remove tmdbId into the correct array column */
  async toggle(userId: string, tmdbId: string, type: Kind) {
    await this.ensureWatchlist(userId);

    const field: Field = type === 'movie' ? 'movieId' : 'seriesId';
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const numericId = Number(tmdbId);

    return this.prisma.$transaction(async (tx) => {
      // Add-or-remove happens inside the DB under a row lock, so concurrent
      // toggles serialize on the row and can't lose updates. RETURNING reports
      // the post-update state, so `added` is the real transition — not a stale read.
      const rows = await tx.$queryRawUnsafe<ToggleRow[]>(
        `UPDATE "Watchlist"
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
        create: { tmdbId: numericId, mediaType, savedCount: added ? 1 : 0 },
        update: { savedCount: { increment: added ? 1 : -1 } },
      });

      return {
        removed: !added,
        totalMovies: row?.movieId.length ?? 0,
        totalSeries: row?.seriesId.length ?? 0,
      };
    });
  }

  /** Optional clear-all */
  async clear(userId: string) {
    await this.ensureWatchlist(userId);

    return this.prisma.$transaction(async (tx) => {
      // Lock the row so concurrent toggles wait, then read the ids we're about to drop.
      const rows = await tx.$queryRawUnsafe<{ movieId: string[]; seriesId: string[] }[]>(
        `SELECT "movieId", "seriesId" FROM "Watchlist" WHERE "userId" = $1 FOR UPDATE`,
        userId,
      );
      const cur = rows[0] ?? { movieId: [], seriesId: [] };
      const movieIds = cur.movieId.map(Number).filter((n) => !Number.isNaN(n));
      const seriesIds = cur.seriesId.map(Number).filter((n) => !Number.isNaN(n));

      if (movieIds.length) {
        await tx.mediaStat.updateMany({
          where: { mediaType: MediaType.MOVIE, tmdbId: { in: movieIds } },
          data: { savedCount: { decrement: 1 } },
        });
      }
      if (seriesIds.length) {
        await tx.mediaStat.updateMany({
          where: { mediaType: MediaType.TV, tmdbId: { in: seriesIds } },
          data: { savedCount: { decrement: 1 } },
        });
      }

      return tx.watchlist.update({
        where: { userId },
        data: { movieId: [], seriesId: [] },
      });
    });
  }

  async removeFromWatchlist(
    userId: string,
    type: 'movie' | 'tv',
    tmdbId: number,
  ) {
    await this.ensureWatchlist(userId);

    const field: Field = type === 'movie' ? 'movieId' : 'seriesId';
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const idStr = String(tmdbId);
    const label = type === 'movie' ? 'Movie' : 'Series';

    return this.prisma.$transaction(async (tx) => {
      // Only updates (and only returns a row) when the id was actually present,
      // so the counter is decremented exactly once and never for a no-op.
      const rows = await tx.$queryRawUnsafe<{ userId: string }[]>(
        `UPDATE "Watchlist"
            SET "${field}" = array_remove("${field}", $1)
          WHERE "userId" = $2 AND $1 = ANY("${field}")
          RETURNING "userId"`,
        idStr,
        userId,
      );

      if (rows.length === 0) {
        return { message: `${label} ${tmdbId} was not in watchlist` };
      }

      await tx.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId, mediaType } },
        create: { tmdbId, mediaType, savedCount: 0 },
        update: { savedCount: { decrement: 1 } },
      });

      return { message: `${label} ${tmdbId} removed from watchlist` };
    });
  }
}
