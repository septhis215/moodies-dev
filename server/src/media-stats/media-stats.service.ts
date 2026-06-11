import { Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TMDBService } from '../external-apis/services/tmdb.service';

export interface EngagementStat {
  likeCount: number;
  savedCount: number;
  reviewCount: number;
}

// Key format: `${tmdbId}:movie` or `${tmdbId}:tv`
export type StatsRecord = Record<string, EngagementStat>;

export interface CommunityPulseItem {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
  likeCount: number;
  reviewCount: number;
  savedCount: number;
}

export interface CommunityPulseData {
  mostLiked: CommunityPulseItem[];
  mostReviewed: CommunityPulseItem[];
  mostSaved: CommunityPulseItem[];
}

@Injectable()
export class MediaStatsService {
  constructor(
    private prisma: PrismaService,
    private tmdb: TMDBService,
  ) {}

  async getBatch(
    items: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>,
  ): Promise<StatsRecord> {
    if (!items.length) return {};

    // Deduplicate
    const unique = Array.from(
      new Map(items.map((i) => [`${i.tmdbId}:${i.mediaType}`, i])).values(),
    );

    const rows = await this.prisma.mediaStat.findMany({
      where: {
        OR: unique.map(({ tmdbId, mediaType }) => ({
          tmdbId,
          mediaType: mediaType === 'movie' ? MediaType.MOVIE : MediaType.TV,
        })),
      },
      select: {
        tmdbId: true,
        mediaType: true,
        likeCount: true,
        savedCount: true,
        reviewCount: true,
      },
    });

    // Seed all requested keys with zeros
    const result: StatsRecord = {};
    for (const { tmdbId, mediaType } of unique) {
      result[`${tmdbId}:${mediaType}`] = { likeCount: 0, savedCount: 0, reviewCount: 0 };
    }

    // Overwrite with real DB values
    for (const row of rows) {
      const type = row.mediaType === MediaType.MOVIE ? 'movie' : 'tv';
      result[`${row.tmdbId}:${type}`] = {
        likeCount: row.likeCount,
        savedCount: row.savedCount,
        reviewCount: row.reviewCount,
      };
    }

    return result;
  }

  async getCommunityPulse(
    mediaType: 'movie' | 'tv',
    limit: number,
  ): Promise<CommunityPulseData> {
    const prismaType = mediaType === 'movie' ? MediaType.MOVIE : MediaType.TV;
    const select = {
      tmdbId: true,
      likeCount: true,
      reviewCount: true,
      savedCount: true,
    } as const;

    // Parallel queries — each sorted by its primary stat, zero rows excluded
    const [liked, reviewed, saved] = await Promise.all([
      this.prisma.mediaStat.findMany({
        where: { mediaType: prismaType, likeCount: { gt: 0 } },
        orderBy: { likeCount: 'desc' },
        take: limit,
        select,
      }),
      this.prisma.mediaStat.findMany({
        where: { mediaType: prismaType, reviewCount: { gt: 0 } },
        orderBy: { reviewCount: 'desc' },
        take: limit,
        select,
      }),
      this.prisma.mediaStat.findMany({
        where: { mediaType: prismaType, savedCount: { gt: 0 } },
        orderBy: { savedCount: 'desc' },
        take: limit,
        select,
      }),
    ]);

    // Batch-fetch TMDB metadata for unique IDs only
    const uniqueIds = [
      ...new Set([
        ...liked.map((r) => r.tmdbId),
        ...reviewed.map((r) => r.tmdbId),
        ...saved.map((r) => r.tmdbId),
      ]),
    ];

    const tmdbResults = await Promise.allSettled(
      uniqueIds.map((id) => this.fetchTmdbBasicInfo(id, mediaType)),
    );

    const tmdbMap = new Map<number, { title: string; poster_path: string | null; vote_average: number; release_date: string }>();
    uniqueIds.forEach((id, i) => {
      const r = tmdbResults[i];
      if (r.status === 'fulfilled' && r.value) tmdbMap.set(id, r.value);
    });

    const toItems = (
      rows: typeof liked,
    ): CommunityPulseItem[] =>
      rows
        .map((row) => {
          const meta = tmdbMap.get(row.tmdbId);
          if (!meta) return null;
          return {
            id: row.tmdbId,
            title: meta.title,
            poster_path: meta.poster_path,
            vote_average: meta.vote_average,
            release_date: meta.release_date,
            likeCount: row.likeCount,
            reviewCount: row.reviewCount,
            savedCount: row.savedCount,
          };
        })
        .filter((x): x is CommunityPulseItem => x !== null);

    return {
      mostLiked: toItems(liked),
      mostReviewed: toItems(reviewed),
      mostSaved: toItems(saved),
    };
  }

  private async fetchTmdbBasicInfo(
    tmdbId: number,
    mediaType: 'movie' | 'tv',
  ): Promise<{ title: string; poster_path: string | null; vote_average: number; release_date: string } | null> {
    try {
      const path = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
      const data = await this.tmdb.request<any>(path);
      return {
        title: data.title ?? data.name ?? '',
        poster_path: data.poster_path ?? null,
        vote_average: data.vote_average ?? 0,
        // Normalise both movie release_date and TV first_air_date to one field
        release_date: data.release_date ?? data.first_air_date ?? '',
      };
    } catch {
      return null;
    }
  }
}
