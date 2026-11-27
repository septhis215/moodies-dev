import { VideoFeedService } from './video-feed.service';
import { FeedUtilsService } from './feed-utils.service';
import { VideoScoringService } from '../videos/video-scoring.service';
import { RedisService } from 'src/redis/redis.service';

describe('video feed session pooling', () => {
  it('probes the top two videos before considering lower quality fallbacks', async () => {
    const scoring = new VideoScoringService();
    const available = jest.spyOn(scoring, 'isVideoAvailable').mockResolvedValue(true);
    const redis = { getOrSet: jest.fn(async (_key, _ttl, load) => load()) };
    const utils = new FeedUtilsService({} as any, redis as unknown as RedisService, scoring);
    const result = await utils.processItemWithVideos({ id: 1, media_type: 'movie', videos: [
      { key: 'abcdefghijk', site: 'YouTube', name: 'Official Trailer', type: 'Trailer', official: true, iso_3166_1: 'FR' },
      { key: 'lmnopqrstuv', site: 'YouTube', name: 'Official Teaser', type: 'Teaser', official: true },
      { key: '12345678901', site: 'YouTube', name: 'Official Clip', type: 'Clip', official: true },
    ] }, 42);
    expect(available).toHaveBeenCalledTimes(2);
    expect(result?.primary_video.type).toBe('Trailer');
  });
  function setup() {
    const cache = new Map<string, any>();
    const redis = { getOrSet: jest.fn(async (key, _ttl, load, shouldCache = () => true) => {
      if (cache.has(key)) return structuredClone(cache.get(key));
      const value = await load();
      if (shouldCache(value)) cache.set(key, structuredClone(value));
      return value;
    }) };
    const utils = new FeedUtilsService({} as any, redis as unknown as RedisService, new VideoScoringService());
    const history = jest.spyOn(utils, 'getViewedTrailerHistory').mockResolvedValue([]);
    const source = jest.spyOn(utils, 'getCachedTmdb').mockImplementation(async endpoint => ({ results: Array.from({ length: 20 }, (_, index) => ({
      id: index + 1, name: 'A title', overview: 'A good story.', poster_path: '/poster', genre_ids: [index % 4], vote_count: 300, vote_average: 7, original_language: 'ms', release_date: '1990-01-01',
    })) }));
    const enrich = jest.spyOn(utils, 'enrichWithVideos').mockImplementation(async items => items.map(item => ({ ...item, primary_video: { key: 'abcdefghijk' } })));
    return { service: new VideoFeedService(redis as unknown as RedisService, utils), utils, history, source, enrich };
  }

  it('freezes history and paginates disjoint media identities in a session', async () => {
    const { service, utils, history, source, enrich } = setup();
    const first = await service.getVideoFeed(42, 1, undefined, 10, 'viewer');
    history.mockResolvedValue([{ itemKey: 'movie:1', trailerKey: 'movie:1:abcdefghijk', id: 1, mediaType: 'movie', viewedAt: Date.now() }]);
    const second = await service.getVideoFeed(42, 2, undefined, 10, 'viewer');
    expect(first.total_pages).toBe(4);
    expect(first.results.some(item => second.results.some(other => utils.getItemKey(item) === utils.getItemKey(other)))).toBe(false);
    expect(await service.getVideoFeed(42, 1, undefined, 10, 'viewer')).toEqual(first);
    expect(history).toHaveBeenCalledTimes(1);
    expect(enrich.mock.calls.every(([items]) => items.length <= 10)).toBe(true);
    expect(source).toHaveBeenCalledTimes(21);
  });

  it('reuses the shared pool across refreshes and suppresses previously seen titles', async () => {
    const { service, history, source } = setup();
    await service.getVideoFeed(42, 1, 'movie', 10, 'viewer');
    history.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({ itemKey: `movie:${index + 1}`, trailerKey: `movie:${index + 1}:abcdefghijk`, id: index + 1, mediaType: 'movie', viewedAt: Date.now() })));
    const fresh = await service.getVideoFeed(93, 1, 'movie', 10, 'viewer');
    expect(fresh.results.every(item => item.id > 10)).toBe(true);
    expect(source).toHaveBeenCalledTimes(11);
  });

  it('continues past an empty video page and stops at the real pool boundary', async () => {
    const { service, enrich } = setup();
    enrich.mockResolvedValue([]);
    const first = await service.getVideoFeed(42, 1, 'movie', 10);
    expect(first.results).toEqual([]);
    expect(first.hasMore).toBe(true);
    expect(first.nextPage).toBe(2);
    const end = await service.getVideoFeed(42, 2, 'movie', 10);
    expect(end.hasMore).toBe(false);
    expect(end.nextPage).toBeNull();
  });

  it('keeps query cache keys distinct for OR versus AND filters', () => {
    const { utils } = setup();
    expect(utils.cacheKey('tmdb', 'discover/movie?with_genres=18|35')).not.toBe(utils.cacheKey('tmdb', 'discover/movie?with_genres=18,35'));
  });

  it('reports upstream outages instead of presenting them as an exhausted feed', async () => {
    const { service, source } = setup();
    source.mockRejectedValue(new Error('TMDB unavailable'));
    await expect(service.getVideoFeed(42)).rejects.toThrow('temporarily unavailable');
  });

  it('isolates upcoming sessions and keeps only future titles inside six months', async () => {
    const { service, source } = setup();
    const release = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    source.mockImplementation(async endpoint => ({ results: [
      { id: 1, title: 'Soon', overview: 'A coming story.', poster_path: '/p', popularity: 20, release_date: release },
      { id: 2, title: 'Released', overview: 'An old story.', poster_path: '/p', popularity: 20, release_date: '2020-01-01', vote_count: 100, vote_average: 8 },
    ] }));
    const result = await service.getVideoFeed(42, 1, undefined, 10, 'viewer', true);
    expect(result.results.every(item => item.id === 1)).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(source).toHaveBeenCalledTimes(8);
  });
});
