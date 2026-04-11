import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';
type Field = 'movieId' | 'seriesId';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  /** Ensure the user has one watchlist row */
  private async ensureWatchlist(userId: string) {
    return this.prisma.watchlist.upsert({
      where: { userId },
      update: {},
      create: {
        user: { connect: { id: userId } },
        movieId: [],
        seriesId: [],
      },
    });
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

    // update MUST target a unique field -> use the row id
    const updated = await this.prisma.watchlist.update({
      where: { id: wl.id },
      data: { [field]: updatedArr } as any,
    });

    return {
      removed: existed,
      totalMovies: updated.movieId.length,
      totalSeries: updated.seriesId.length,
    };
  }

  /** Optional clear-all */
  async clear(userId: string) {
    const wl = await this.ensureWatchlist(userId);
    return this.prisma.watchlist.update({
      where: { id: wl.id },
      data: { movieId: [], seriesId: [] },
    });
  }



  async removeFromWatchlist(
    userId: string,
    type: 'movie' | 'tv',
    tmdbId: number,
  ) {
    const wl = await this.ensureWatchlist(userId);

    const idStr = String(tmdbId);

    if (type === 'movie') {
      const updated = (wl.movieId ?? []).filter((x) => x !== idStr);
      // IMPORTANT: update by unique primary key (id), not userId
      await this.prisma.watchlist.update({
        where: { id: wl.id },
        data: { movieId: updated },
      });
      return { message: `Movie ${tmdbId} removed from watchlist` };
    } else {
      const updated = (wl.seriesId ?? []).filter((x) => x !== idStr);
      await this.prisma.watchlist.update({
        where: { id: wl.id },
        data: { seriesId: updated },
      });
      return { message: `Series ${tmdbId} removed from watchlist` };
    }
  }



}
