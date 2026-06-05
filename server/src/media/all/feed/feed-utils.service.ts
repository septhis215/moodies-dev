import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { VideoScoringService } from '../videos/video-scoring.service';
import { CACHE_TTL, getSeededRandom, isUpcoming } from '../utils/helpers';

export type FeedMediaType = 'movie' | 'tv';

export type FeedResponse<T = any> = {
  results: T[];
  page: number;
  total_pages: number;
  hasMore: boolean;
  nextPage: number | null;
};

export type ViewedTrailerEntry = {
  itemKey: string;
  trailerKey: string;
  mediaType: FeedMediaType;
  id: number;
  videoKey?: string;
  viewedAt: number;
};

@Injectable()
export class FeedUtilsService {
  private readonly logger = new Logger(FeedUtilsService.name);
  private readonly allowedRegions = [
    'MY',
    'SG',
    'ID',
    'TH',
    'PH',
    'VN',
    'BN',
    'KH',
    'LA',
    'HK',
    'TW',
    'IN',
    'AU',
    'NZ',
    'US',
    'GB',
    'KR',
    'JP',
  ];

  constructor(
    private readonly client: TmdbClientService,
    private readonly redisService: RedisService,
    private readonly videoScoring: VideoScoringService,
  ) {}

  cacheKey(...parts: Array<string | number | boolean | null | undefined>) {
    return parts
      .filter((part) => part !== undefined && part !== null && part !== '')
      .map((part) => String(part).replace(/[^a-zA-Z0-9:_-]/g, '_'))
      .join(':');
  }

  getMediaType(item: any): FeedMediaType {
    if (item.media_type === 'movie' || item.type === 'movie' || item.title)
      return 'movie';
    return 'tv';
  }

  uniqueByMedia(items: any[]): any[] {
    return Array.from(
      new Map(
        items.map((item) => [`${this.getMediaType(item)}:${item.id}`, item]),
      ).values(),
    );
  }

  getItemKey(item: any) {
    return `${this.getMediaType(item)}:${item.id}`;
  }

  normalizeViewerId(viewerId?: string) {
    if (!viewerId || typeof viewerId !== 'string') return null;
    const normalized = viewerId.trim().replace(/[^a-zA-Z0-9:_-]/g, '_');
    return normalized.length > 0 ? normalized.slice(0, 96) : null;
  }

  getViewedHistoryKey(viewerId: string) {
    return this.cacheKey('video-feed-viewed', viewerId);
  }

  async getViewedTrailerHistory(
    viewerId?: string,
  ): Promise<ViewedTrailerEntry[]> {
    const viewerKey = this.normalizeViewerId(viewerId);
    if (!viewerKey) return [];

    try {
      const raw = await this.redisService.get(
        this.getViewedHistoryKey(viewerKey),
      );
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ViewedTrailerEntry[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (entry) =>
            entry?.itemKey &&
            entry?.trailerKey &&
            (entry.mediaType === 'movie' || entry.mediaType === 'tv') &&
            Number.isFinite(Number(entry.id)),
        )
        .slice(0, 200);
    } catch {
      return [];
    }
  }

  getHistorySeed(history: ViewedTrailerEntry[]) {
    if (history.length === 0) return 0;
    return history.slice(0, 30).reduce((seed, entry, index) => {
      const text = `${entry.trailerKey}:${Math.floor(entry.viewedAt / 60000)}`;
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) % 1000003;
      }
      return (seed + hash + index * 97) % 1000003;
    }, history.length * 131);
  }

  prioritizeUnviewed<T = any>(items: T[], viewedItemKeys: Set<string>) {
    if (viewedItemKeys.size === 0) return items;

    const unviewed = items.filter(
      (item) => !viewedItemKeys.has(this.getItemKey(item)),
    );
    const viewed = items.filter((item) =>
      viewedItemKeys.has(this.getItemKey(item)),
    );

    return unviewed.length >= Math.min(12, items.length)
      ? unviewed
      : [...unviewed, ...viewed];
  }

  async recordViewedTrailer(
    viewerId: string | undefined,
    mediaType: FeedMediaType,
    id: number,
    videoKey?: string,
  ) {
    const viewerKey = this.normalizeViewerId(viewerId);
    if (!viewerKey || !id || !mediaType) return { ok: false };

    const history = await this.getViewedTrailerHistory(viewerKey);
    const itemKey = `${mediaType}:${id}`;
    const trailerKey = `${itemKey}:${videoKey || 'primary'}`;
    const nextHistory: ViewedTrailerEntry[] = [
      { itemKey, trailerKey, mediaType, id, videoKey, viewedAt: Date.now() },
      ...history.filter((entry) => entry.trailerKey !== trailerKey),
    ].slice(0, 200);

    await this.redisService.set(
      this.getViewedHistoryKey(viewerKey),
      JSON.stringify(nextHistory),
      60 * 60 * 24 * 45,
    );

    return { ok: true };
  }

  normalizeItem(item: any) {
    const mediaType = this.getMediaType(item);
    const title = item.title || item.name || 'Untitled';
    const releaseDate = item.release_date || item.first_air_date || null;

    return {
      ...item,
      title,
      name: title,
      release_date: releaseDate,
      first_air_date: releaseDate,
      media_type: mediaType,
      type: mediaType,
      overview: item.overview || '',
      poster_path: item.poster_path ?? null,
      backdrop_path: item.backdrop_path ?? null,
      genres: Array.isArray(item.genres)
        ? item.genres
            .map((genre: any) =>
              typeof genre === 'string' ? genre : genre?.name,
            )
            .filter(Boolean)
        : [],
      vote_average: item.vote_average || 0,
      vote_count: item.vote_count || 0,
      popularity: item.popularity || 0,
      original_language: item.original_language || 'en',
      videos: item.videos || [],
      primary_video: item.primary_video || null,
    };
  }

  normalizeResults(items: any[]) {
    return items.map((item) => this.normalizeItem(item));
  }

  paginate<T>(
    results: T[],
    page: number,
    totalPages: number,
    hasMore?: boolean,
  ): FeedResponse<T> {
    const more = hasMore ?? (page < totalPages && results.length > 0);
    return {
      results,
      page,
      total_pages: totalPages,
      hasMore: more,
      nextPage: more ? page + 1 : null,
    };
  }

  async getCachedTmdb(endpoint: string, ttlSeconds = CACHE_TTL.BASIC_DATA) {
    const key = this.cacheKey('tmdb', endpoint);
    return this.redisService.getOrSet(
      key,
      ttlSeconds,
      () => this.client.tmdb(endpoint),
      (value) => Boolean(value),
    );
  }

  async enrichWithVideos(
    items: any[],
    seed: number,
    options: {
      targetCount?: number;
      batchSize?: number;
      allowUpcomingFallback?: boolean;
    } = {},
  ) {
    const enriched: any[] = [];
    const targetCount = Math.min(items.length, options.targetCount ?? 30);
    const batchSize = options.batchSize ?? 8;

    for (
      let i = 0;
      i < items.length && enriched.length < targetCount;
      i += batchSize
    ) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((item) =>
          this.processItemWithVideos(
            item,
            seed,
            options.allowUpcomingFallback ?? false,
          ),
        ),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          enriched.push(result.value);
          if (enriched.length >= targetCount) break;
        } else if (result.status === 'rejected') {
          this.logger.error('Failed to enrich feed item', result.reason);
        }
      }
    }

    return enriched;
  }

  async processItemWithVideos(
    item: any,
    seed: number,
    allowUpcomingFallback = false,
  ) {
    try {
      const mediaType = this.getMediaType(item);
      const videos = await this.getVideosForItem(
        mediaType,
        item.id,
        item.videos,
      );
      const filteredVideos = this.videoScoring.filterVideos(
        videos,
        this.allowedRegions,
      );
      if (filteredVideos.length === 0) return null;

      const sortedCandidates = this.videoScoring
        .sortByScore(filteredVideos)
        .slice(0, 8);
      const availableVideos =
        await this.getCachedAvailableVideos(sortedCandidates);
      const videosToUse =
        availableVideos.length > 0
          ? availableVideos
          : allowUpcomingFallback && isUpcoming(item)
            ? sortedCandidates.slice(0, 3)
            : [];

      if (videosToUse.length === 0) return null;

      const topVideos = this.videoScoring.sortByScore(videosToUse).slice(0, 8);
      const primaryCandidates = topVideos.slice(
        0,
        Math.min(4, topVideos.length),
      );
      const primaryIndex = getSeededRandom(
        item.id + seed,
        primaryCandidates.length,
      );
      const primaryVideo = primaryCandidates[primaryIndex];
      if (!primaryVideo?.key) return null;

      return this.normalizeItem({
        ...item,
        media_type: mediaType,
        videos: topVideos,
        primary_video: primaryVideo,
      });
    } catch (err) {
      this.logger.error(`Error processing feed item ${item?.id}`, err as any);
      return null;
    }
  }

  private async getVideosForItem(
    mediaType: FeedMediaType,
    id: number,
    existingVideos?: any[],
  ) {
    if (Array.isArray(existingVideos) && existingVideos.length > 0)
      return existingVideos;

    const response = await this.redisService.getOrSet(
      this.cacheKey('feed-videos', mediaType, id),
      CACHE_TTL.TRAILERS,
      () => this.client.tmdb(`${mediaType}/${id}/videos?language=en-US`),
      (value) => Boolean(value),
    );

    return response?.results || [];
  }

  private async getCachedAvailableVideos(videos: any[]) {
    const candidates = videos.slice(0, Math.min(videos.length, 5));
    const checks = await Promise.allSettled(
      candidates.map(async (video) => {
        const available = await this.redisService.getOrSet(
          this.cacheKey('youtube-oembed', video.key),
          CACHE_TTL.TRAILERS,
          () => this.videoScoring.isVideoAvailable(video.key),
        );

        return available ? { ...video, available: true } : null;
      }),
    );

    return checks
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value,
      )
      .map((result) => result.value);
  }
}
