import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';

@Injectable()
export class LikedService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the liked list as { movieId, seriesId } string-id arrays, preserving the
   * legacy response shape. One indexed query over normalized rows.
   */
  async getAll(userId: string) {
    const items = await this.prisma.likedItem.findMany({
      where: { userId },
      select: { tmdbId: true, mediaType: true },
    });
    const movieId: string[] = [];
    const seriesId: string[] = [];
    for (const item of items) {
      (item.mediaType === MediaType.MOVIE ? movieId : seriesId).push(String(item.tmdbId));
    }
    return { userId, movieId, seriesId };
  }

  /** Toggle a title in/out of the liked list — a single-row insert or delete. */
  async toggle(userId: string, tmdbId: string, type: Kind) {
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const numericId = Number(tmdbId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.likedItem.findUnique({
        where: { userId_tmdbId_mediaType: { userId, tmdbId: numericId, mediaType } },
        select: { id: true },
      });

      let delta = 0;
      if (existing) {
        const { count } = await tx.likedItem.deleteMany({
          where: { userId, tmdbId: numericId, mediaType },
        });
        delta = count > 0 ? -1 : 0;
      } else {
        try {
          await tx.likedItem.create({ data: { userId, tmdbId: numericId, mediaType } });
          delta = 1;
        } catch (e) {
          // Lost the add race to a concurrent toggle — the row exists now, no net change.
          if (!(e instanceof PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        }
      }

      if (delta !== 0) {
        await tx.mediaStat.upsert({
          where: { tmdbId_mediaType: { tmdbId: numericId, mediaType } },
          create: { tmdbId: numericId, mediaType, likeCount: delta > 0 ? 1 : 0 },
          update: { likeCount: { increment: delta } },
        });
      }

      const [totalMovies, totalSeries] = await Promise.all([
        tx.likedItem.count({ where: { userId, mediaType: MediaType.MOVIE } }),
        tx.likedItem.count({ where: { userId, mediaType: MediaType.TV } }),
      ]);

      return { liked: !existing, totalMovies, totalSeries };
    });
  }

  async remove(userId: string, type: 'movie' | 'tv', tmdbId: number) {
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const label = type === 'movie' ? 'Movie' : 'Series';

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.likedItem.deleteMany({
        where: { userId, tmdbId, mediaType },
      });

      if (count === 0) {
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
