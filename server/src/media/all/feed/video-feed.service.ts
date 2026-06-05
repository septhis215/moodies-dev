import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { FeedUtilsService } from './feed-utils.service';
import {
  CACHE_TTL,
  seededShuffleArray,
  isRecentOrUpcoming,
  getItemYear,
  isUpcoming,
  isRecentRelease,
} from '../utils/helpers';

@Injectable()
export class VideoFeedService {
  private readonly logger = new Logger(VideoFeedService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly feedUtils: FeedUtilsService,
  ) {}

  async getVideoFeed(
    salt: number = 0,
    page: number = 1,
    mediaType?: 'movie' | 'tv',
    limit: number = 18,
    viewerId?: string,
  ) {
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    const safeLimit = Math.max(1, Math.min(Number(limit) || 18, 35));
    const safeSalt = Math.abs(Number(salt) || 0) % 500;
    const viewerKey = this.feedUtils.normalizeViewerId(viewerId);
    const viewedHistory = viewerKey
      ? await this.feedUtils.getViewedTrailerHistory(viewerKey)
      : [];
    const viewedVideoKeys = this.feedUtils.getViewedVideoKeys(viewedHistory);
    const historySeed = this.feedUtils.getHistorySeed(viewedHistory);
    const cacheKey = this.feedUtils.cacheKey(
      'video-feed',
      mediaType || 'all',
      safePage,
      safeLimit,
      safeSalt,
      viewerKey ? `viewer_${viewerKey}` : 'anon',
      historySeed,
    );

    return this.redisService.getOrSet(
      cacheKey,
      60 * 12,
      () =>
        this.buildVideoFeed(
          safeSalt + historySeed,
          safePage,
          mediaType,
          safeLimit,
          viewedVideoKeys,
        ),
      (value) => Array.isArray(value?.results) && value.results.length > 0,
    );
  }

  async recordViewedTrailer(
    viewerId: string | undefined,
    mediaType: 'movie' | 'tv',
    id: number,
    videoKey?: string,
  ) {
    return this.feedUtils.recordViewedTrailer(
      viewerId,
      mediaType,
      id,
      videoKey,
    );
  }

  private async buildVideoFeed(
    salt: number,
    page: number,
    mediaType?: 'movie' | 'tv',
    limit: number = 18,
    viewedVideoKeys: Set<string> = new Set(),
  ) {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 2);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const sessionSeed = Math.floor(Date.now() / (1000 * 60 * 15));
      const pageSeed = sessionSeed + page + salt;
      const pageOffset = Math.floor((page - 1) / 3);
      const tmdbPageVariant = (pageSeed % 3) + 1;
      const endpoints: string[] = [];

      if (!mediaType || mediaType === 'movie') {
        endpoints.push(
          `trending/movie/week?page=${page}`,
          `movie/upcoming?page=${tmdbPageVariant}&region=US`,
          `discover/movie?sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`,
          `discover/movie?sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${tmdbPageVariant}`,
          `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${pastDateStr}&page=${page}`,
          `discover/movie?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`,
        );
      }

      if (!mediaType || mediaType === 'tv') {
        endpoints.push(
          `trending/tv/week?page=${page}`,
          `tv/popular?page=${page + pageOffset}`,
          `tv/on_the_air?page=${page}`,
          `tv/airing_today?page=${page}`,
          `discover/tv?sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${page}`,
          `discover/tv?sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${tmdbPageVariant}`,
          `discover/tv?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`,
        );
      }

      const sourceResults = await Promise.allSettled(
        endpoints.map((endpoint) =>
          this.feedUtils.getCachedTmdb(endpoint, CACHE_TTL.BASIC_DATA),
        ),
      );
      const allItems: any[] = [];

      for (const result of sourceResults) {
        if (result.status === 'fulfilled' && result.value?.results) {
          allItems.push(...result.value.results);
        }
      }

      const filteredItems = this.preFilterItems(allItems);
      const uniqueItems = this.feedUtils.uniqueByMedia(filteredItems);
      const scoredMixed = this.seededShuffle(uniqueItems, pageSeed, 2.0);
      const itemsToEnrich = scoredMixed.slice(0, Math.max(limit * 3, 35));
      const itemsWithVideos = await this.feedUtils.enrichWithVideos(
        itemsToEnrich,
        pageSeed,
        {
          targetCount: Math.min(Math.max(limit * 2, 20), 35),
          batchSize: 8,
          allowUpcomingFallback: true,
          viewedVideoKeys,
        },
      );

      const validItems = itemsWithVideos.filter((item) => item.primary_video);
      const finalResults = this.feedUtils.normalizeResults(
        this.applyFinalShuffle(validItems, pageSeed, viewedVideoKeys).slice(
          0,
          limit,
        ),
      );

      this.logger.debug(
        `Video feed page ${page}: ${finalResults.length}/${uniqueItems.length} results`,
      );
      return this.feedUtils.paginate(
        finalResults,
        page,
        100,
        page < 100 && finalResults.length > 0,
      );
    } catch (error) {
      this.logger.error('Error fetching video feed', error as any);
      return this.feedUtils.paginate([], page, 0, false);
    }
  }

  private applyFinalShuffle(
    items: any[],
    seed: number,
    viewedVideoKeys: Set<string> = new Set(),
  ): any[] {
    if (items.length === 0) return items;

    const orderedItems = this.feedUtils.prioritizeUnviewedVideos(
      items,
      viewedVideoKeys,
      { keepViewedFallback: true },
    );
    const upcomingItems = orderedItems.filter((i) => isUpcoming(i));
    const releasedItems = orderedItems.filter((i) => !isUpcoming(i));
    const tiers = {
      premium: [] as any[],
      high: [] as any[],
      medium: [] as any[],
    };

    releasedItems.forEach((item) => {
      const score = this.calculateItemQualityScore(item);
      if (score >= 45) tiers.premium.push(item);
      else if (score >= 35) tiers.high.push(item);
      else tiers.medium.push(item);
    });

    const shuffledPremium = seededShuffleArray(tiers.premium, seed);
    const shuffledHigh = seededShuffleArray(tiers.high, seed + 100);
    const shuffledMedium = seededShuffleArray(tiers.medium, seed + 200);
    const upcomingSeed = seed ^ (seed << 5) ^ 0xdeadbeef;
    const shuffledUpcoming = seededShuffleArray(upcomingItems, upcomingSeed);
    const result: any[] = [];
    let pIdx = 0,
      hIdx = 0,
      mIdx = 0,
      uIdx = 0;
    const upcomingInterval = 4;
    let slotCount = 0;

    while (
      pIdx < shuffledPremium.length ||
      hIdx < shuffledHigh.length ||
      mIdx < shuffledMedium.length ||
      uIdx < shuffledUpcoming.length
    ) {
      if (
        uIdx < shuffledUpcoming.length &&
        slotCount % upcomingInterval === 0
      ) {
        result.push(shuffledUpcoming[uIdx++]);
        slotCount++;
        continue;
      }

      for (let i = 0; i < 2 && pIdx < shuffledPremium.length; i++) {
        result.push(shuffledPremium[pIdx++]);
        slotCount++;
      }
      if (hIdx < shuffledHigh.length) {
        result.push(shuffledHigh[hIdx++]);
        slotCount++;
      }
      if (pIdx < shuffledPremium.length) {
        result.push(shuffledPremium[pIdx++]);
        slotCount++;
      }
      if (mIdx < shuffledMedium.length) {
        result.push(shuffledMedium[mIdx++]);
        slotCount++;
      }
    }

    while (uIdx < shuffledUpcoming.length)
      result.push(shuffledUpcoming[uIdx++]);
    return this.feedUtils.prioritizeUnviewedVideos(result, viewedVideoKeys, {
      keepViewedFallback: true,
    });
  }

  private seededShuffle(array: any[], seed: number, jitter = 2.0): any[] {
    const seededRandomForId = (id: number | string, offset = 0) => {
      const n =
        typeof id === 'number'
          ? id
          : parseInt(String(id).replace(/\D/g, '') || '0', 10);
      const x = Math.sin((seed + offset) * 9301 + n * 49297) * 43758.5453123;
      return Math.abs(x - Math.floor(x));
    };

    const scoredItems = array.map((item) => ({
      item,
      qualityScore: this.calculateItemQualityScore(item),
      isNewRelease: isRecentOrUpcoming(item),
      isKorean: item.original_language === 'ko',
    }));

    const compareWithJitter = (a: any, b: any) => {
      const scoreDiff = b.qualityScore - a.qualityScore;
      if (jitter === 0) return scoreDiff;
      const randDiff =
        seededRandomForId(b.item.id ?? Math.random() * 1000000) -
        seededRandomForId(a.item.id ?? Math.random() * 1000000);
      return scoreDiff + randDiff * jitter;
    };

    const newReleases = scoredItems.filter((s) => s.isNewRelease);
    const koreanContent = scoredItems.filter(
      (s) => !s.isNewRelease && s.isKorean,
    );
    const regularContent = scoredItems.filter(
      (s) => !s.isNewRelease && !s.isKorean,
    );

    newReleases.sort(compareWithJitter);
    koreanContent.sort(compareWithJitter);
    regularContent.sort(compareWithJitter);

    const mixed: any[] = [];
    let newIdx = 0,
      koreanIdx = 0,
      regularIdx = 0;

    while (
      newIdx < newReleases.length ||
      koreanIdx < koreanContent.length ||
      regularIdx < regularContent.length
    ) {
      const regularCount =
        Math.floor(seededRandomForId(regularIdx + seed, 100) * 2) + 2;
      for (
        let i = 0;
        i < regularCount && regularIdx < regularContent.length;
        i++
      ) {
        mixed.push(regularContent[regularIdx++].item);
      }
      if (newIdx < newReleases.length) mixed.push(newReleases[newIdx++].item);
      if (koreanIdx < koreanContent.length)
        mixed.push(koreanContent[koreanIdx++].item);
      if (
        koreanIdx < koreanContent.length &&
        seededRandomForId(koreanIdx + seed, 200) > 0.6
      ) {
        mixed.push(koreanContent[koreanIdx++].item);
      }
    }

    return mixed;
  }

  private preFilterItems(items: any[]): any[] {
    return items.filter((item) => {
      if (item.adult === true) return false;
      if (!item.poster_path) return false;

      const releaseYear = getItemYear(item);
      const upcoming = isUpcoming(item);
      const isNewRelease = isRecentRelease(item);
      const isKorean = item.original_language === 'ko';

      if (upcoming) {
        if ((item.popularity || 0) < 20) return false;
        return true;
      }

      if (!isNewRelease && !isKorean) {
        if ((item.vote_count || 0) < 10) return false;
        if ((item.vote_average || 0) < 5.0) return false;
      } else if (isKorean && !isNewRelease) {
        if ((item.vote_count || 0) < 5) return false;
        if ((item.vote_average || 0) < 4.5) return false;
      }

      if (releaseYear && releaseYear < (isKorean ? 1995 : 2000)) return false;
      if (!item.overview || item.overview.length < 10) return false;

      const allowedLanguages = [
        'en',
        'es',
        'fr',
        'de',
        'ja',
        'ko',
        'zh',
        'pt',
        'it',
        'hi',
      ];
      if (
        item.original_language &&
        !allowedLanguages.includes(item.original_language)
      ) {
        if ((item.vote_count || 0) < 500) return false;
      }
      return true;
    });
  }

  private calculateItemQualityScore(item: any): number {
    let score = 0;
    const upcoming = isUpcoming(item);
    const recentlyReleased = isRecentRelease(item);
    const popularity = item.popularity || 0;

    if (upcoming) {
      score += 25;
      const releaseDate = new Date(item.release_date || item.first_air_date);
      const daysUntilRelease =
        (releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilRelease <= 30) score += 15;
      else if (daysUntilRelease <= 90) score += 10;
      else if (daysUntilRelease <= 180) score += 5;
      score += Math.log10(popularity + 1) * 24;
      score += this.getPopularityBucketScore(popularity);
    } else {
      if (recentlyReleased) score += 20;
      score += Math.log10(popularity + 1) * 11;
      score += this.getPopularityBucketScore(popularity) * 0.65;
      if (item.vote_count > 0) score += (item.vote_average || 0) * 3;
      score += Math.log10((item.vote_count || 1) + 1) * 2;

      const year = getItemYear(item);
      if (year && !recentlyReleased) {
        const yearDiff = new Date().getFullYear() - year;
        if (yearDiff <= 2) score += 10;
        else if (yearDiff <= 5) score += 7;
        else if (yearDiff <= 10) score += 5;
        else if (yearDiff <= 15) score += 3;
      }
    }

    if (item.backdrop_path) score += 2;
    score += this.getMarketRelevanceScore(item);

    return score;
  }

  private getPopularityBucketScore(popularity: number) {
    if (popularity >= 250) return 18;
    if (popularity >= 150) return 13;
    if (popularity >= 80) return 9;
    if (popularity >= 40) return 5;
    return 0;
  }

  private getMarketRelevanceScore(item: any) {
    let score = 0;
    const language = item.original_language || '';
    const countries = new Set<string>([
      ...(item.origin_country || []),
      ...((item.production_countries || []) as any[]).map(
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
}
