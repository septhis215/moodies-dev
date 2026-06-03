import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
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

    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const numericId = Number(tmdbId);

    // Update the user's liked array and the content's like counter atomically.
    const [updated] = await this.prisma.$transaction([
      this.prisma.likedList.update({
        where: { userId },
        data: { [field]: updatedArr } as any,
      }),
      this.prisma.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId: numericId, mediaType } },
        create: { tmdbId: numericId, mediaType, likeCount: existed ? 0 : 1 },
        update: { likeCount: { increment: existed ? -1 : 1 } },
      }),
    ]);

    return {
      liked: !existed,
      totalMovies: updated.movieId.length,
      totalSeries: updated.seriesId.length,
    };
  }

  async remove(userId: string, type: 'movie' | 'tv', tmdbId: number) {
    const list = await this.ensureLikedList(userId);
    const idStr = String(tmdbId);
    const field = type === 'movie' ? 'movieId' : 'seriesId';
    const arr = (list as any)[field] as string[];

    // Nothing to remove — skip so we never decrement a counter we didn't add to.
    if (!arr.includes(idStr)) {
      return { message: `${type === 'movie' ? 'Movie' : 'Series'} ${tmdbId} was not liked` };
    }

    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const updated = arr.filter((x) => x !== idStr);

    await this.prisma.$transaction([
      this.prisma.likedList.update({
        where: { userId },
        data: { [field]: updated } as any,
      }),
      this.prisma.mediaStat.upsert({
        where: { tmdbId_mediaType: { tmdbId, mediaType } },
        create: { tmdbId, mediaType, likeCount: 0 },
        update: { likeCount: { decrement: 1 } },
      }),
    ]);

    return {
      message: `${type === 'movie' ? 'Movie' : 'Series'} ${tmdbId} removed from liked`,
    };
  }
}
