import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the watchlist as { movieId, seriesId } string-id arrays, preserving the
   * legacy response shape so the client is unaffected. Now one indexed query over
   * normalized rows instead of loading a per-user array column.
   */
  async getAll(userId: string) {
    const items = await this.prisma.watchlistItem.findMany({
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

  /** Toggle a title in/out of the watchlist — a single-row insert or delete. */
  async toggle(userId: string, tmdbId: string, type: Kind) {
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const numericId = Number(tmdbId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.watchlistItem.findUnique({
        where: { userId_tmdbId_mediaType: { userId, tmdbId: numericId, mediaType } },
        select: { id: true },
      });

      // delta drives the counter and reflects the *actual* transition, so it can't
      // drift even under a concurrent toggle of the same title.
      let delta = 0;
      if (existing) {
        const { count } = await tx.watchlistItem.deleteMany({
          where: { userId, tmdbId: numericId, mediaType },
        });
        delta = count > 0 ? -1 : 0;
      } else {
        try {
          await tx.watchlistItem.create({ data: { userId, tmdbId: numericId, mediaType } });
          delta = 1;
        } catch (e) {
          // Lost the add race to a concurrent toggle — the row exists now, no net change.
          if (!(e instanceof PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        }
      }

      if (delta !== 0) {
        await tx.mediaStat.upsert({
          where: { tmdbId_mediaType: { tmdbId: numericId, mediaType } },
          create: { tmdbId: numericId, mediaType, savedCount: delta > 0 ? 1 : 0 },
          update: { savedCount: { increment: delta } },
        });
      }

      return { removed: !!existing };
    });
  }

  /** Clear the entire watchlist. */
  async clear(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.watchlistItem.findMany({
        where: { userId },
        select: { tmdbId: true, mediaType: true },
      });
      if (items.length === 0) return { movieId: [], seriesId: [] };

      const movieIds = items
        .filter((i) => i.mediaType === MediaType.MOVIE)
        .map((i) => i.tmdbId);
      const seriesIds = items
        .filter((i) => i.mediaType === MediaType.TV)
        .map((i) => i.tmdbId);

      await tx.watchlistItem.deleteMany({ where: { userId } });

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

      return { movieId: [], seriesId: [] };
    });
  }

  async removeFromWatchlist(userId: string, type: 'movie' | 'tv', tmdbId: number) {
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const label = type === 'movie' ? 'Movie' : 'Series';

    return this.prisma.$transaction(async (tx) => {
      // deleteMany returns the count, so the counter decrements exactly once and
      // never for a no-op.
      const { count } = await tx.watchlistItem.deleteMany({
        where: { userId, tmdbId, mediaType },
      });

      if (count === 0) {
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
