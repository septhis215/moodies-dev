import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Kind = 'movie' | 'series';

@Injectable()
export class LikedService {
  constructor(private prisma: PrismaService) {}

  private async ensureLikedList(userId: string) {
    return this.prisma.likedList.upsert({
      where: { userId },
      update: {},
      create: {
        user: { connect: { id: userId } },
        movieId: [],
        seriesId: [],
      },
    });
  }

  async getAll(userId: string) {
    return this.ensureLikedList(userId);
  }

  async toggle(userId: string, tmdbId: string, type: Kind) {
    const list = await this.ensureLikedList(userId);

    const field = type === 'movie' ? 'movieId' : 'seriesId';
    const arr = (list as any)[field] as string[];

    const existed = arr.includes(tmdbId);
    const updatedArr = existed
      ? arr.filter((id) => id !== tmdbId)
      : [...arr, tmdbId];

    const updated = await this.prisma.likedList.update({
      where: { userId },
      data: { [field]: updatedArr } as any,
    });

    return {
      liked: !existed,
      totalMovies: updated.movieId.length,
      totalSeries: updated.seriesId.length,
    };
  }

  async remove(userId: string, type: 'movie' | 'tv', tmdbId: number) {
    const list = await this.ensureLikedList(userId);
    const idStr = String(tmdbId);

    if (type === 'movie') {
      const updated = list.movieId.filter((x) => x !== idStr);
      await this.prisma.likedList.update({
        where: { userId },
        data: { movieId: updated },
      });
      return { message: `Movie ${tmdbId} removed from liked` };
    } else {
      const updated = list.seriesId.filter((x) => x !== idStr);
      await this.prisma.likedList.update({
        where: { userId },
        data: { seriesId: updated },
      });
      return { message: `Series ${tmdbId} removed from liked` };
    }
  }
}
