import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { classifyTitle, type TitleEvidence } from './achievement-rules';

type TmdbTitle = {
  id?: number;
  title?: string;
  name?: string;
  adult?: boolean;
  genres?: Array<{ id: number }>;
  production_countries?: Array<{ iso_3166_1: string }>;
  origin_country?: string[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  poster_path?: string | null;
};
export interface VerifiedTitle extends TitleEvidence {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
}
@Injectable()
export class AchievementEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TMDBService,
  ) {}

  async title(type: 'movie' | 'tv', id: number): Promise<VerifiedTitle> {
    const key = `${type}:${id}`;
    const cached = await this.prisma.achievementTitleSnapshot.findUnique({
      where: { key },
    });
    if (cached && cached.fetchedAt.getTime() > Date.now() - 7 * 86400000)
      return cached.metadata as unknown as VerifiedTitle;
    const data = await this.tmdb.request<TmdbTitle>(`${type}/${id}`);
    if (
      data.id !== id ||
      !(data.title || data.name) ||
      !Array.isArray(data.genres) ||
      ![data.vote_average, data.vote_count, data.popularity].every(
        (value) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0,
      )
    )
      throw new Error('Invalid title evidence');
    const metadata: VerifiedTitle = {
      id,
      type,
      title: String(data.title || data.name).slice(0, 300),
      posterPath:
        typeof data.poster_path === 'string' &&
        /^\/[\w.-]+$/.test(data.poster_path)
          ? data.poster_path
          : null,
      adult: data.adult === true,
      genreIds: data.genres
        .map((genre) => genre.id)
        .filter(Number.isSafeInteger),
      countries: [
        ...new Set([
          ...(data.origin_country || []),
          ...(data.production_countries || []).map(
            (country) => country.iso_3166_1,
          ),
        ]),
      ].filter((country) => /^[A-Z]{2}$/.test(country)),
      rating: data.vote_average!,
      votes: data.vote_count!,
      popularity: data.popularity!,
    };
    await this.prisma.achievementTitleSnapshot.upsert({
      where: { key },
      create: { key, metadata: { ...metadata } },
      update: { metadata: { ...metadata }, fetchedAt: new Date() },
    });
    return metadata;
  }

  async classifications(type: 'movie' | 'tv', id: number, occurredAt: Date) {
    const [title, trend] = await Promise.all([
      this.title(type, id),
      this.prisma.achievementTrendSnapshot.findFirst({
        where: {
          capturedAt: { lte: occurredAt },
          validUntil: { gt: occurredAt },
        },
        orderBy: { capturedAt: 'desc' },
      }),
    ]);
    return {
      title,
      metrics: classifyTitle(title, !!trend?.keys.includes(`${type}:${id}`)),
      trendSnapshotId: trend?.id || null,
    };
  }

  async captureTrends() {
    const data = await this.tmdb.request<{
      results?: Array<{ id: number; media_type: string; adult?: boolean }>;
    }>('trending/all/week');
    if (!Array.isArray(data.results)) throw new Error('Invalid trend snapshot');
    const capturedAt = new Date();
    const keys = data.results
      .filter(
        (title) =>
          Number.isSafeInteger(title.id) &&
          title.id > 0 &&
          ['movie', 'tv'].includes(title.media_type) &&
          !title.adult,
      )
      .map((title) => `${title.media_type}:${title.id}`);
    await this.prisma.achievementTrendSnapshot.create({
      data: {
        keys,
        capturedAt,
        validUntil: new Date(capturedAt.getTime() + 3600000),
      },
    });
  }
}
