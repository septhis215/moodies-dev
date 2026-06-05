import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { TmdbAll } from '../types/tmdb.types';
import { CACHE_TTL, seededShuffleArray } from '../utils/helpers';
import { FeedUtilsService } from '../feed/feed-utils.service';

@Injectable()
export class UpcomingFeedService {
  private readonly logger = new Logger(UpcomingFeedService.name);

  constructor(
    private readonly client: TmdbClientService,
    private readonly redisService: RedisService,
    private readonly feedUtils: FeedUtilsService,
  ) {}

  async getUpcomingFeeds(
    page: number = 1,
    limit: number = 35,
    viewerId?: string,
  ) {
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    const safeLimit = Math.max(1, Math.min(Number(limit) || 35, 35));
    const viewerKey = this.feedUtils.normalizeViewerId(viewerId);
    const viewedHistory = viewerKey
      ? await this.feedUtils.getViewedTrailerHistory(viewerKey)
      : [];
    const viewedVideoKeys = this.feedUtils.getViewedVideoKeys(viewedHistory);
    const historySeed = this.feedUtils.getHistorySeed(viewedHistory);
    const cacheKey = this.feedUtils.cacheKey(
      'upcoming-feed',
      safePage,
      safeLimit,
      viewerKey ? `viewer_${viewerKey}` : 'anon',
      historySeed,
    );

    if (!this.client.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return this.feedUtils.paginate([], safePage, 0, false);
    }

    return this.redisService.getOrSet(
      cacheKey,
      60 * 20,
      () =>
        this.buildUpcomingFeeds(
          safePage,
          safeLimit,
          viewedVideoKeys,
          historySeed,
        ),
      (value) => Array.isArray(value?.results) && value.results.length > 0,
    );
  }

  private async buildUpcomingFeeds(
    page: number,
    limit: number,
    viewedVideoKeys: Set<string> = new Set(),
    historySeed: number = 0,
  ) {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      const tmdbPagesPerRequest = 3;
      const startTmdbPage = (page - 1) * tmdbPagesPerRequest + 1;
      const tmdbPages = Array.from(
        { length: tmdbPagesPerRequest },
        (_, index) => startTmdbPage + index,
      );
      const pageSeed = page * 12345 + historySeed;
      const recycledMode =
        viewedVideoKeys.size > 0 &&
        page > 1 &&
        viewedVideoKeys.size >= (page - 1) * Math.max(limit, 1);

      const endpoints = tmdbPages.flatMap((tmdbPage) => [
        {
          mediaType: 'movie' as const,
          endpoint: `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&primary_release_date.lte=${futureDateStr}&page=${tmdbPage}`,
        },
        {
          mediaType: 'tv' as const,
          endpoint: `discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&first_air_date.lte=${futureDateStr}&page=${tmdbPage}`,
        },
      ]);

      if (recycledMode) {
        endpoints.push(
          {
            mediaType: 'movie' as const,
            endpoint: `movie/upcoming?language=en-US&region=US&page=${((page + historySeed) % 4) + 1}`,
          },
          {
            mediaType: 'movie' as const,
            endpoint: `discover/movie?language=en-US&sort_by=popularity.desc&with_original_language=ko&primary_release_date.gte=${todayStr}&primary_release_date.lte=${futureDateStr}&page=${((page + historySeed) % 3) + 1}`,
          },
          {
            mediaType: 'tv' as const,
            endpoint: `discover/tv?language=en-US&sort_by=popularity.desc&with_original_language=ko&first_air_date.gte=${todayStr}&first_air_date.lte=${futureDateStr}&page=${((page + historySeed) % 3) + 1}`,
          },
        );
      }

      const sourceResults = await Promise.allSettled(
        endpoints.map(async (source) => {
          const data = await this.feedUtils.getCachedTmdb(
            source.endpoint,
            CACHE_TTL.BASIC_DATA,
          );
          return (data?.results || []).map((item: any) =>
            this.toUpcomingCandidate(item, source.mediaType, today),
          );
        }),
      );

      const candidates = sourceResults
        .flatMap((result) =>
          result.status === 'fulfilled' ? result.value : [],
        )
        .filter((item): item is TmdbAll => Boolean(item));
      const uniqueItems = this.feedUtils.uniqueByMedia(candidates);
      const exhaustedMode =
        viewedVideoKeys.size > 0 &&
        page > 1 &&
        viewedVideoKeys.size >= page * Math.max(limit, 1);
      const rankedBase = this.shuffleUpcomingTrailers(
        uniqueItems,
        exhaustedMode ? pageSeed + viewedVideoKeys.size * 409 : pageSeed,
      );
      const ranked = this.prioritizeUpcomingPool(rankedBase, new Set(), false);
      const detailTarget = Math.min(
        Math.max(limit * (exhaustedMode ? 3 : 2), 24),
        ranked.length,
      );
      const detailedItems = await this.enrichDetails(
        ranked.slice(0, detailTarget),
      );
      const enrichedItems = await this.feedUtils.enrichWithVideos(
        detailedItems,
        pageSeed,
        {
          targetCount: Math.min(limit, 30),
          batchSize: 8,
          allowUpcomingFallback: true,
          viewedVideoKeys,
        },
      );

      const results = this.feedUtils
        .normalizeResults(
          this.prioritizeUpcomingPool(
            enrichedItems,
            viewedVideoKeys,
            exhaustedMode,
          ),
        )
        .slice(0, limit);
      const hasMore =
        page < 100 &&
        (results.length >= Math.floor(limit * 0.5) ||
          uniqueItems.length >= limit ||
          exhaustedMode);

      this.logger.debug(
        `Upcoming feed page ${page}: ${results.length}/${uniqueItems.length} results, viewedVideos=${viewedVideoKeys.size}, recycled=${exhaustedMode}`,
      );
      return this.feedUtils.paginate(
        results,
        page,
        100,
        hasMore && results.length > 0,
      );
    } catch (err) {
      this.logger.error('Failed to fetch upcoming trailers feed', err as any);
      return this.feedUtils.paginate([], page, 0, false);
    }
  }

  private toUpcomingCandidate(
    item: any,
    mediaType: 'movie' | 'tv',
    today: Date,
  ) {
    const releaseDate = item.release_date ?? item.first_air_date;
    if (!releaseDate || new Date(releaseDate) < today) return null;
    if (!item.poster_path || !item.overview || item.overview.length < 10)
      return null;

    return {
      ...item,
      title: item.title ?? item.name ?? 'Untitled',
      name: item.title ?? item.name ?? 'Untitled',
      release_date: releaseDate,
      first_air_date: releaseDate,
      type: mediaType,
      media_type: mediaType,
      recommendations: [],
      genres: [],
      vote_average: item.vote_average || 0,
      vote_count: item.vote_count || 0,
      popularity: item.popularity || 0,
      original_language: item.original_language || 'en',
    } as TmdbAll;
  }

  private async enrichDetails(items: TmdbAll[]) {
    const tasks = items.map((item) => async () => {
      const mediaType = item.type === 'tv' ? 'tv' : 'movie';

      try {
        const details = await this.redisService.getOrSet(
          this.feedUtils.cacheKey('feed-detail', mediaType, item.id),
          CACHE_TTL.BASIC_DATA,
          () =>
            this.client.tmdb(
              `${mediaType}/${item.id}?language=en-US&append_to_response=videos`,
            ),
          (value) => Boolean(value),
        );

        const videos = details?.videos?.results || [];
        return {
          ...item,
          runtime: mediaType === 'movie' ? (details?.runtime ?? null) : null,
          number_of_episodes:
            mediaType === 'tv' ? (details?.number_of_episodes ?? null) : null,
          genres: Array.isArray(details?.genres)
            ? details.genres.map((g: any) => g.name).filter(Boolean)
            : [],
          production_countries: details?.production_countries || [],
          origin_country: details?.origin_country || item.origin_country || [],
          videos,
        };
      } catch (err) {
        this.logger.error(
          `Failed to fetch details for ${mediaType} ${item.id}`,
          err as any,
        );
        return item;
      }
    });

    return this.client.withConcurrencyLimit(tasks, 8);
  }

  private shuffleUpcomingTrailers(items: TmdbAll[], seed: number): TmdbAll[] {
    if (items.length === 0) return items;

    const seededRandomForId = (id: number) => {
      const x = Math.sin(seed * 9301 + id * 49297) * 43758.5453123;
      return Math.abs(x - Math.floor(x));
    };

    const jitter = 2.5;
    const scoredItems = items.map((item) => ({
      item,
      qualityScore: this.calculateUpcomingQualityScore(item),
      releaseDateScore: this.getReleaseDateProximityScore(item),
    }));

    scoredItems.sort((a, b) => {
      const scoreDiff =
        b.qualityScore +
        b.releaseDateScore -
        (a.qualityScore + a.releaseDateScore);
      const randA = seededRandomForId(a.item.id);
      const randB = seededRandomForId(b.item.id);
      return scoreDiff + (randB - randA) * jitter;
    });

    const tiers = {
      premium: [] as TmdbAll[],
      high: [] as TmdbAll[],
      medium: [] as TmdbAll[],
    };
    scoredItems.forEach((scored) => {
      const totalScore = scored.qualityScore + scored.releaseDateScore;
      if (totalScore >= 45) tiers.premium.push(scored.item);
      else if (totalScore >= 30) tiers.high.push(scored.item);
      else tiers.medium.push(scored.item);
    });

    return [
      ...seededShuffleArray(tiers.premium, seed),
      ...seededShuffleArray(tiers.high, seed + 100),
      ...seededShuffleArray(tiers.medium, seed + 200),
    ];
  }

  private calculateUpcomingQualityScore(item: TmdbAll): number {
    let score = 0;
    const popularity = item.popularity || 0;
    score += Math.log10(popularity + 1) * 14;
    if (popularity >= 250) score += 18;
    else if (popularity >= 150) score += 13;
    else if (popularity >= 80) score += 9;
    else if (popularity >= 40) score += 5;

    if (item.vote_average && item.vote_average > 0)
      score += item.vote_average * 3;
    score += Math.log10((item.vote_count || 1) + 1) * 5;
    if (item.backdrop_path) score += 3;
    if (item.overview && item.overview.length > 100) score += 2;
    if (item.type === 'movie') score += 2;
    score += this.getMarketRelevanceScore(item);
    return score;
  }

  private prioritizeUpcomingPool(
    items: TmdbAll[],
    viewedVideoKeys: Set<string>,
    exhaustedMode: boolean,
  ) {
    if (viewedVideoKeys.size === 0) return items;

    const unviewed = items.filter(
      (item) => !viewedVideoKeys.has(this.feedUtils.getPrimaryVideoKey(item)),
    );
    const viewed = items.filter((item) =>
      viewedVideoKeys.has(this.feedUtils.getPrimaryVideoKey(item)),
    );

    if (!exhaustedMode && unviewed.length >= Math.min(12, items.length)) {
      return unviewed;
    }

    return [
      ...unviewed,
      ...viewed.sort(
        (a, b) =>
          this.calculateUpcomingQualityScore(b) -
          this.calculateUpcomingQualityScore(a),
      ),
    ];
  }

  private getMarketRelevanceScore(item: TmdbAll) {
    let score = 0;
    const language = item.original_language || '';
    const countries = new Set<string>([
      ...(item.origin_country || []),
      ...((item as any).production_countries || []).map(
        (country: any) => country?.iso_3166_1,
      ),
    ]);

    if (language === 'en') score += 8;
    else if (language === 'ko') score += 9;
    else if (language === 'ja') score += 6;
    else if (['zh', 'cn'].includes(language)) score += 5;
    else if (['es', 'fr', 'de', 'hi'].includes(language)) score += 4;

    if (countries.has('US')) score += 7;
    if (countries.has('GB')) score += 6;
    if (countries.has('KR')) score += 8;
    if (countries.has('JP')) score += 5;
    if (countries.has('CA') || countries.has('AU')) score += 3;
    if (countries.has('HK') || countries.has('TW')) score += 3;
    if (countries.has('IN')) score += 3;

    return score;
  }

  private getReleaseDateProximityScore(item: TmdbAll): number {
    if (!item.release_date) return 0;
    const releaseDate = new Date(item.release_date);
    const daysUntilRelease = Math.floor(
      (releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilRelease <= 14) return 12;
    if (daysUntilRelease <= 30) return 10;
    if (daysUntilRelease <= 60) return 8;
    if (daysUntilRelease <= 90) return 4;
    if (daysUntilRelease <= 180) return 2;
    return 0;
  }
}
