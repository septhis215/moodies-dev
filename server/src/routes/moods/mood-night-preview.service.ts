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
  private readonly snapshots = new Map<string, { payload: NightPreview; expiresAt: Date }>();
  private cacheRetryAt = 0;

  constructor(private readonly prisma: PrismaService, private readonly moods: MoodsService, private readonly all: AllService) {}

  async getPreview(choice: string, forceRefresh = false): Promise<NightPreview> {
    if (!Object.hasOwn(CHOICES, choice)) throw new BadRequestException('Unknown night mood');
    const row = await this.readSnapshot(choice);
    const cached = row?.payload;
    if (cached && Array.isArray(cached.trailers) && !forceRefresh && row.expiresAt.getTime() > Date.now()) return cached;
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

  private async readSnapshot(choice: string): Promise<{ payload: NightPreview; expiresAt: Date } | undefined> {
    if (this.cacheRetryAt <= Date.now()) {
      try {
        const row = await this.prisma.moodNightPreview.findUnique({ where: { choice } });
        if (row) {
          const snapshot = { payload: row.payload as unknown as NightPreview, expiresAt: row.expiresAt };
          this.snapshots.set(choice, snapshot);
          return snapshot;
        }
      } catch (error: unknown) {
        this.cacheUnavailable(error);
      }
    }
    return this.snapshots.get(choice);
  }

  private cacheUnavailable(error: unknown): void {
    this.cacheRetryAt = Date.now() + 60_000;
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'unavailable';
    this.logger.warn(`Night preview cache ${code}; using in-memory snapshots. ${code === 'P2021' ? 'Apply the mood_night_previews migration with prisma migrate deploy.' : 'Database cache will retry in one minute.'}`);
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
    // Cache storage is optional: a missing migration must not discard valid picks.
    this.snapshots.set(choice, { payload, expiresAt: data.expiresAt });
    if (this.cacheRetryAt <= Date.now()) {
      try {
        await this.prisma.moodNightPreview.upsert({ where: { choice }, create: { choice, ...data }, update: data });
      } catch (error: unknown) {
        this.cacheUnavailable(error);
      }
    }
    this.retryAfter.delete(choice);
    return payload;
  }
}
