import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AllService } from 'src/media/all/all.service';
import { runWithTmdbPriority, TMDB_PRIORITY } from 'src/external-apis/services/tmdb-priority.context';
import { MoodsService } from './moods.service';

const CHOICES = { easy: 'Cozy', tense: 'Thrilling', tender: 'Romantic', strange: 'Mind-Bending', electric: 'Epic' } as const;
const HOUR = 60 * 60 * 1000;
type NightItem = { id: number; type: 'movie' | 'tv'; title: string; poster: string | null; backdrop: string | null };
type NightTrailer = { item: NightItem; key: string };
export type NightPreview = { items: NightItem[]; trailer: NightTrailer | null; trailers?: NightTrailer[] };

@Injectable()
export class MoodNightPreviewService {
  private readonly logger = new Logger(MoodNightPreviewService.name);
  private readonly pending = new Map<string, Promise<NightPreview>>();
  private readonly retryAfter = new Map<string, number>();

  constructor(private readonly prisma: PrismaService, private readonly moods: MoodsService, private readonly all: AllService) {}

  async getPreview(choice: string, forceRefresh = false): Promise<NightPreview> {
    if (!Object.hasOwn(CHOICES, choice)) throw new BadRequestException('Unknown night mood');
    const row = await this.prisma.moodNightPreview.findUnique({ where: { choice } });
    const cached = row?.payload as unknown as NightPreview | undefined;
    if (cached && Array.isArray(cached.trailers) && !forceRefresh && row!.expiresAt.getTime() > Date.now()) return cached;
    // Serve the last successful snapshot immediately, including after an API restart.
    if (cached && !forceRefresh) {
      if ((this.retryAfter.get(choice) ?? 0) <= Date.now()) {
        void runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, () => this.refresh(choice, cached))
          .catch((error: unknown) => this.logger.warn(`Preview refresh failed for ${choice}: ${error instanceof Error ? error.message : String(error)}`));
      }
      return cached;
    }
    if ((this.retryAfter.get(choice) ?? 0) > Date.now()) {
      if (cached) return cached;
      throw new ServiceUnavailableException('Tonight’s picks are temporarily unavailable.');
    }
    return this.refresh(choice, cached);
  }

  async warmPreviews(): Promise<void> {
    // Sequential warming avoids flooding TMDB with five recommendation generations.
    for (const choice of Object.keys(CHOICES)) {
      try { await this.getPreview(choice, true); }
      catch (error) { this.logger.warn(`Could not warm ${choice}: ${(error as Error).message}`); }
    }
  }

  private refresh(choice: string, cached?: NightPreview): Promise<NightPreview> {
    const pending = this.pending.get(choice);
    if (pending) return pending;
    const task = this.build(choice, cached)
      .catch(error => {
        this.retryAfter.set(choice, Date.now() + 60_000);
        throw error;
      })
      .finally(() => this.pending.delete(choice));
    this.pending.set(choice, task);
    return task;
  }

  private async build(choice: string, cached?: NightPreview): Promise<NightPreview> {
    const mood = await this.prisma.mood.findFirst({
      where: { name: { equals: CHOICES[choice as keyof typeof CHOICES], mode: 'insensitive' }, isActive: true },
    });
    if (!mood) throw new ServiceUnavailableException('This night mood is temporarily unavailable.');
    // The landing preview is public and shared; never store user-specific responses.
    const result = await this.moods.getRecommendations({ moodId: mood.id, userId: 'anonymous', mediaType: 'both', limit: 4, page: 1, shuffle: false });
    const items = result.recommendations.flatMap<NightItem>(rec => {
      const type = rec.mediaType === 'MOVIE' ? 'movie' : rec.mediaType === 'TV' ? 'tv' : null;
      return type && rec.tmdbId > 0 ? [{ id: rec.tmdbId, type, title: rec.title, poster: rec.posterPath, backdrop: rec.backdropPath }] : [];
    }).slice(0, 4);
    // Empty generation can mean an upstream outage; do not overwrite a good snapshot.
    if (!items.length) throw new ServiceUnavailableException('Tonight’s picks are temporarily unavailable.');
    const videos = await this.all.getTrailersForItems(items);
    const trailers = items.flatMap<NightTrailer>(item => {
      const key = videos[`${item.type}-${item.id}`];
      return typeof key === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(key) ? [{ item, key }] : [];
    });
    const trailer = trailers[0] ?? null;
    // The trailer adapter returns null on upstream failures as well as missing videos.
    if (!trailer && cached?.trailer) throw new ServiceUnavailableException('Trailer refresh is temporarily unavailable.');
    const payload: NightPreview = { items, trailer, trailers };
    const fetchedAt = new Date();
    const data = { payload: payload as unknown as Prisma.InputJsonValue, fetchedAt, expiresAt: new Date(fetchedAt.getTime() + (trailer ? 24 : 1) * HOUR) };
    await this.prisma.moodNightPreview.upsert({ where: { choice }, create: { choice, ...data }, update: data });
    this.retryAfter.delete(choice);
    return payload;
  }
}
