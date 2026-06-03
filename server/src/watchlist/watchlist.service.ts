import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';
type Field = 'movieId' | 'seriesId';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) { }

  /** Ensure the user has one watchlist row */
  private async ensureWatchlist(userId: string) {
    let watchlist = await this.prisma.watchlist.findFirst({
      where: { userId },
    });

    if (!watchlist) {
      watchlist = await this.prisma.watchlist.create({
        data: {
          user: { connect: { id: userId } },
          movieId: [],
          seriesId: [],
        },
      });
    }

    return watchlist;
  }



  /** Get watchlist */
  async getAll(userId: string) {
    return this.ensureWatchlist(userId);
  }

  /** Toggle add/remove tmdbId into the correct array column */
  async toggle(userId: string, tmdbId: string, type: Kind) {
    const wl = await this.ensureWatchlist(userId);

    const field: Field = type === 'movie' ? 'movieId' : 'seriesId';
    const arr = (wl as any)[field] as string[];

    const existed = arr.includes(tmdbId);
    const updatedArr = existed ? arr.filter(id => id !== tmdbId) : [...arr, tmdbId];

    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const numericId = Number(tmdbId);

    // update MUST target a unique field -> use the row id.
    // Adjust the content's saved counter in the same transaction.
    const [updated] = await this.prisma.$transaction([
      this.prisma.watchlist.update({
        where: { id: wl.id },
        data: { [field]: updatedArr } as any,
      }),
      this.prisma.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId: numericId, mediaType } },
        create: { tmdbId: numericId, mediaType, savedCount: existed ? 0 : 1 },
        update: { savedCount: { increment: existed ? -1 : 1 } },
      }),
    ]);

    return {
      removed: existed,
      totalMovies: updated.movieId.length,
      totalSeries: updated.seriesId.length,
    };
  }

  /** Optional clear-all */
  async clear(userId: string) {
    const wl = await this.ensureWatchlist(userId);

    const movieIds = (wl.movieId ?? []).map(Number).filter((n) => !Number.isNaN(n));
    const seriesIds = (wl.seriesId ?? []).map(Number).filter((n) => !Number.isNaN(n));

    // Decrement saved counters only for this user's saved items (bounded list,
    // not a full-table scan), then clear the arrays — all in one transaction.
    return this.prisma.$transaction(async (tx) => {
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
        where: { id: wl.id },
        data: { movieId: [], seriesId: [] },
      });
    });
  }



  async removeFromWatchlist(
    userId: string,
    type: 'movie' | 'tv',
    tmdbId: number,
  ) {
    const wl = await this.ensureWatchlist(userId);

    const idStr = String(tmdbId);
    const field: Field = type === 'movie' ? 'movieId' : 'seriesId';
    const arr = (wl as any)[field] as string[];

    // Nothing to remove — skip so we never decrement a counter we didn't add to.
    if (!arr.includes(idStr)) {
      return { message: `${type === 'movie' ? 'Movie' : 'Series'} ${tmdbId} was not in watchlist` };
    }

    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const updated = arr.filter((x) => x !== idStr);

    // IMPORTANT: update by unique primary key (id), not userId
    await this.prisma.$transaction([
      this.prisma.watchlist.update({
        where: { id: wl.id },
        data: { [field]: updated } as any,
      }),
      this.prisma.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId, mediaType } },
        create: { tmdbId, mediaType, savedCount: 0 },
        update: { savedCount: { decrement: 1 } },
      }),
    ]);

    return {
      message: `${type === 'movie' ? 'Movie' : 'Series'} ${tmdbId} removed from watchlist`,
    };
  }



}
