import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { FeedUtilsService } from './feed-utils.service';
import { isUpcoming, isRecentRelease } from '../utils/helpers';
import { rankRecommendations } from 'src/utils/recommendation-ranking';

@Injectable()
export class VideoFeedService {
  constructor(private readonly redisService: RedisService, private readonly feedUtils: FeedUtilsService) {}

  async getVideoFeed(salt = 0, page = 1, mediaType?: 'movie' | 'tv', limit = 18, viewerId?: string, upcomingOnly = false) {
    const safePage = Math.max(1, Math.min(Math.trunc(Number(page) || 1), 100));
    const safeLimit = Math.max(1, Math.min(Math.trunc(Number(limit) || 18), 35));
    const seed = Number(salt) >>> 0;
    const type = mediaType === 'movie' || mediaType === 'tv' ? mediaType : undefined;
    const viewer = this.feedUtils.normalizeViewerId(viewerId) || 'anon';
    const sessionKey = this.feedUtils.cacheKey('video-feed-v2-session', upcomingOnly ? 'upcoming' : 'mixed', type || 'all', viewer, seed);
    // Freeze history and candidate order: playback must not move later pages.
    const session = await this.redisService.getOrSet(sessionKey, 3600, async () => {
      const history = await this.feedUtils.getViewedTrailerHistory(viewerId);
      const viewedItems = new Set(history.map(entry => entry.itemKey));
      const pool = await this.getCandidatePool(type, upcomingOnly);
      const ranked = rankRecommendations(pool, item => ({
        key: this.feedUtils.getItemKey(item), score: this.qualityScore(item),
        genres: item.genre_ids || [], language: item.original_language,
        type: this.feedUtils.getMediaType(item), year: item.release_date || item.first_air_date,
        collection: item.belongs_to_collection?.id,
      }), seed, 12);
      return {
        createdAt: Date.now(),
        candidates: [...ranked.filter(item => !viewedItems.has(this.feedUtils.getItemKey(item))),
          ...ranked.filter(item => viewedItems.has(this.feedUtils.getItemKey(item)))],
        viewedVideos: [...this.feedUtils.getViewedVideoKeys(history)],
      };
    }, value => value.candidates.length > 0);
    const totalPages = Math.ceil(session.candidates.length / safeLimit);
    return this.redisService.getOrSet(sessionKey + ':' + session.createdAt + ':page:' + safeLimit + ':' + safePage, 3600, async () => {
      const items = session.candidates.slice((safePage - 1) * safeLimit, safePage * safeLimit);
      const results = await this.feedUtils.enrichWithVideos(items, seed, {
        targetCount: safeLimit, batchSize: 6, viewedVideoKeys: new Set(session.viewedVideos),
      });
      return this.feedUtils.paginate(results, safePage, totalPages, safePage < totalPages);
    }, value => value.results.length > 0);
  }

  async recordViewedTrailer(viewerId: string | undefined, mediaType: 'movie' | 'tv', id: number, videoKey?: string) {
    return this.feedUtils.recordViewedTrailer(viewerId, mediaType, id, videoKey);
  }

  private async getCandidatePool(mediaType?: 'movie' | 'tv', upcomingOnly = false): Promise<any[]> {
    const day = new Date().toISOString().slice(0, 10);
    return this.redisService.getOrSet('video-feed-v2-pool:' + (upcomingOnly ? 'upcoming:' : 'mixed:') + (mediaType || 'all') + ':' + day, 3600, async () => {
      const endpoints: Array<{ path: string; type: 'movie' | 'tv' }> = [];
      const types: Array<'movie' | 'tv'> = mediaType ? [mediaType] : ['movie', 'tv'];
      const genreRequests = Promise.allSettled(types.map(async type => {
        const data = await this.feedUtils.getCachedTmdb(`genre/${type}/list?language=en-US`, 86400);
        return { type, genres: new Map<number, string>((data?.genres || []).map((genre: any) => [genre.id, genre.name])) };
      }));
      for (const type of types) {
        if (upcomingOnly) {
          const date = type === 'movie' ? 'primary_release_date' : 'first_air_date';
          const until = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
          for (const page of [1, 2, 3]) endpoints.push({ path: `discover/${type}?include_adult=false&language=en-US&sort_by=popularity.desc&${date}.gte=${day}&${date}.lte=${until}&page=${page}`, type });
          continue;
        }
        for (const page of [1, 2, 3]) {
          endpoints.push({ path: 'trending/' + type + '/week?page=' + page, type });
          endpoints.push({ path: 'discover/' + type + '?include_adult=false&sort_by=vote_average.desc&vote_count.gte=100&vote_average.gte=6&page=' + page, type });
        }
        endpoints.push({ path: type + '/' + (type === 'movie' ? 'now_playing' : 'on_the_air') + '?page=1', type });
        endpoints.push({ path: type + '/popular?page=2', type });
        if (type === 'movie') endpoints.push({ path: 'movie/upcoming?page=1&region=US', type });
        const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
        endpoints.push({ path: 'discover/' + type + '?include_adult=false&sort_by=popularity.desc&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.gte=' + since + '&vote_count.gte=10&page=2', type });
      }
      const responses = await Promise.allSettled(endpoints.map(async source => {
        const data = await this.feedUtils.getCachedTmdb(source.path, 3600);
        if (!Array.isArray(data?.results)) throw new Error('Feed source unavailable');
        return (data?.results || []).map((item: any) => ({ ...item, media_type: source.type }));
      }));
      if (responses.every(result => result.status === 'rejected')) {
        throw new ServiceUnavailableException('The video feed is temporarily unavailable. Please try again.');
      }
      const items = responses.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      const genreResults = await genreRequests;
      const genreMaps = new Map(genreResults.flatMap(result => result.status === 'fulfilled' ? [[result.value.type, result.value.genres] as const] : []));
      return this.feedUtils.uniqueByMedia(items.filter(item => this.isEligible(item) && (!upcomingOnly || isUpcoming(item))))
        .map(item => ({ ...item, genres: (item.genre_ids || []).map((id: number) => genreMaps.get(this.feedUtils.getMediaType(item))?.get(id)).filter(Boolean) }));
    }, value => value.length > 0);
  }

  private isEligible(item: any): boolean {
    if (item.adult || !item.poster_path || !(item.overview || '').trim()) return false;
    if (isUpcoming(item)) {
      const release = Date.parse(item.release_date || item.first_air_date);
      return release <= Date.now() + 180 * 86400000 && (item.popularity || 0) >= 10;
    }
    if (isRecentRelease(item) && (item.vote_count || 0) < 10) return true;
    return (item.vote_count || 0) >= 10 && (item.vote_average || 0) >= 5.5;
  }

  private qualityScore(item: any): number {
    const votes = Math.max(0, item.vote_count || 0);
    const quality = ((item.vote_average || 0) * votes + 6 * 100) / (votes + 100);
    return quality * 6 + Math.log1p(Math.min(120, Math.max(0, item.popularity || 0))) * 3
      + (isRecentRelease(item) ? 6 : 0) + (isUpcoming(item) ? 3 : 0);
  }
}
