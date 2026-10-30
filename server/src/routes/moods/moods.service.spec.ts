import { MoodsService } from './moods.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { RedisService } from 'src/redis/redis.service';

import { profiles } from './mood-review.fixtures';


function cacheMock() {
  const values = new Map<string, any>();
  return { getOrSet: jest.fn(async (key, _ttl, load, shouldCache = () => true) => {
    if (values.has(key)) return structuredClone(values.get(key));
    const value = await load();
    if (shouldCache(value)) values.set(key, JSON.parse(JSON.stringify(value)));
    return value;
  }) };
}

describe('mood recommendation pipeline', () => {
  const mood = (name = 'Happy') => ({ id: 'mood', name, keywords: [], tmdbGenres: [35], valence: 0.6, arousal: 0.3 });
  const candidate = (id = 1) => ({ id, title: 'Friendship', overview: 'A joyful comedy about family and friendship.', genre_ids: [35, 10751], mediaType: 'movie', poster_path: '/poster', vote_average: 7.5, vote_count: 300, popularity: 10, original_language: 'en', release_date: '2020-01-01', _source: 'discover' });
  let service: MoodsService;
  let internal: any;
  let prisma: any;
  let tmdb: any;
  let redis: ReturnType<typeof cacheMock>;
  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) }, mood: { findUnique: jest.fn().mockResolvedValue(mood()), findFirst: jest.fn().mockResolvedValue(mood()) }, recommendation: {
      findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn(),
      upsert: jest.fn(async ({ create }) => ({ id: `rec-${create.tmdbId}`, ...create, liked: true, viewed: false, saved: false })),
    } };
    tmdb = { request: jest.fn().mockResolvedValue({ results: [] }) };
    redis = cacheMock();
    service = new MoodsService(prisma as PrismaService, tmdb as TMDBService, redis as unknown as RedisService);
    internal = service;
    jest.spyOn(internal, 'getGenreMap').mockResolvedValue(new Map([[35, 'Comedy'], [10751, 'Family']]));
  });

  it.each(profiles)('%s accepts a representative match and rejects an unrelated title', (name, genres, overview) => {
    const selectedMood = mood(name);
    const match = { ...candidate(), genre_ids: [...genres], overview, release_date: name === 'Nostalgic' ? '1995-01-01' : '2020-01-01' };
    expect(internal.hasAcceptableMoodGenreFit(internal.scoreItem(match, selectedMood), selectedMood)).toBe(true);
    const unrelated = { ...candidate(), genre_ids: [10767, 10763], overview: 'A daily news bulletin.', mediaType: 'tv' };
    expect(internal.hasAcceptableMoodGenreFit(internal.scoreItem(unrelated, selectedMood), selectedMood)).toBe(false);
  });

  it('does not mistake substring hits or broad Drama for emotional evidence', () => {
    expect(internal.getKeywordMatchScore({ overview: 'A funeral with a glove.' }, ['fun', 'love'])).toBe(0);
    const drama = { ...candidate(), title: 'A Case', genre_ids: [18], overview: 'A lawyer investigates a case.' };
    for (const name of ['Sad', 'Chill', 'Serenity', 'Inspirational']) {
      expect(internal.hasAcceptableMoodGenreFit(internal.scoreItem(drama, mood(name)), mood(name))).toBe(false);
    }
  });

  it('applies requested rating/language, safety and released-only filters to every source', () => {
    expect(internal.passesHardFilters(candidate(), { moodId: 'mood', minRating: 8 })).toBe(false);
    expect(internal.passesHardFilters(candidate(), { moodId: 'mood', languages: ['fr'] })).toBe(false);
    expect(internal.passesHardFilters({ ...candidate(), adult: true }, { moodId: 'mood' })).toBe(false);
    expect(internal.passesHardFilters({ ...candidate(), release_date: '2099-01-01' }, { moodId: 'mood' })).toBe(false);
    expect(internal.passesHardFilters({ ...candidate(), original_language: 'ms' }, { moodId: 'mood' })).toBe(true);
  });

  it('ranks a close mood match ahead of a more popular weak fit', () => {
    const close = internal.scoreItem(candidate(), mood());
    const weak = internal.scoreItem({ ...candidate(), genre_ids: [12], overview: 'A mission.', popularity: 100000, vote_average: 9.5, vote_count: 10000 }, mood());
    expect(close.score).toBeGreaterThan(weak.score);
  });

  it('boosts profile genres and language names/codes without mutating the shared pool', () => {
    const pool = [candidate(), { ...candidate(2), original_language: 'ko', genre_ids: [35] }]
      .map(item => internal.buildRecommendationShape(internal.scoreItem(item, mood()), mood(), 'anonymous', new Map([[35, 'Comedy'], [10751, 'Family']])));
    const snapshot = JSON.stringify(pool);
    const personal = internal.personalizeRecommendations(pool, { preferredGenres: ['family'], preferredLanguages: ['english'] });
    expect(Number(personal[0].score)).toBeGreaterThan(Number(pool[0].score));
    expect(Number(personal[1].score)).toBeLessThan(Number(pool[1].score));
    expect(personal[0].metadata.scoreBreakdown.preferredGenreScore).toBe(0.5);
    expect(personal[0].metadata.scoreBreakdown.languageScore).toBe(1);
    expect(internal.personalizeRecommendations(pool, { preferredGenres: ['35'], preferredLanguages: ['ko'] })[1].metadata.scoreBreakdown.languageScore).toBe(1);
    expect(JSON.stringify(pool)).toBe(snapshot);
  });

  it('uses current profile preferences in session caching while sharing the candidate pool', async () => {
    const pool = [candidate(), { ...candidate(2), original_language: 'ko' }]
      .map(item => internal.buildRecommendationShape(internal.scoreItem(item, mood()), mood(), 'anonymous', new Map()));
    const generate = jest.spyOn(internal, 'generateRecommendations').mockResolvedValue(pool);
    prisma.user.findUnique.mockResolvedValue({ preferredGenres: ['Comedy'], preferredLanguages: ['English'] });
    const dto = { moodId: 'mood', userId: 'alice', shuffle: false };
    expect((await service.getRecommendations(dto)).recommendations[0].tmdbId).toBe(1);
    prisma.user.findUnique.mockResolvedValue({ preferredGenres: ['Comedy'], preferredLanguages: ['Korean'] });
    expect((await service.getRecommendations(dto)).recommendations[0].tmdbId).toBe(2);
    expect((await service.getRecommendations({ ...dto, userId: 'bob' })).recommendations[0].tmdbId).toBe(2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'alice' }, select: { preferredGenres: true, preferredLanguages: true } });
  });

  it('caps popularity and prefers older releases only for Nostalgic', () => {
    expect(internal.scoreItem({ ...candidate(), popularity: 120 }, mood()).score)
      .toBe(internal.scoreItem({ ...candidate(), popularity: 100000 }, mood()).score);
    const old = { ...candidate(), release_date: '1990-01-01' };
    const recent = { ...candidate(), release_date: new Date().toISOString().slice(0, 10) };
    expect(internal.scoreItem(recent, mood()).score).toBeGreaterThan(internal.scoreItem(old, mood()).score);
    expect(internal.scoreItem(old, mood('Nostalgic')).score).toBeGreaterThan(internal.scoreItem(recent, mood('Nostalgic')).score);
  });

  it('personalizes fallback rows while keeping explicit language and rating constraints', async () => {
    const rows = [candidate(), { ...candidate(2), original_language: 'ko' }]
      .map(item => internal.buildRecommendationShape(internal.scoreItem(item, mood()), mood(), 'alice', new Map()));
    prisma.recommendation.findMany.mockResolvedValue(rows);
    const result = await internal.getFallbackRecommendations(mood(), { moodId: 'mood', userId: 'alice', minRating: 7, languages: ['en'], shuffle: false },
      { preferredGenres: ['comedy'], preferredLanguages: ['korean'] });
    expect(result.map(item => item.tmdbId)).toEqual([1]);
    expect(result[0].metadata.scoreBreakdown.languageScore).toBe(0);
    expect(prisma.recommendation.findMany.mock.calls[0][0].where.voteAverage.gte.toNumber()).toBe(7);
  });

  it('keeps pages stable, reports the full total, reuses the pool and varies refresh without deleting feedback', async () => {
    const pool = Array.from({ length: 30 }, (_, index) => internal.buildRecommendationShape(internal.scoreItem(candidate(index + 1), mood()), mood(), 'anonymous', new Map()));
    const generate = jest.spyOn(internal, 'generateRecommendations').mockResolvedValue(pool);
    const dto = { moodId: 'mood', userId: 'alice', limit: 10, seed: 42 };
    const first = await service.getRecommendations(dto);
    const second = await service.getRecommendations({ ...dto, page: 2 });
    expect(first.total).toBe(30);
    expect(first.totalPages).toBe(3);
    expect(first.recommendations.some(item => second.recommendations.some(other => item.tmdbId === other.tmdbId))).toBe(false);
    expect((await service.getRecommendations(dto)).recommendations.map(item => item.tmdbId)).toEqual(first.recommendations.map(item => item.tmdbId));
    const refreshed = await service.regenerateRecommendations({ ...dto, seed: 93, excludeKeys: first.recommendations.map(item => `movie:${item.tmdbId}`) });
    expect(refreshed.recommendations.some(item => first.recommendations.some(other => item.tmdbId === other.tmdbId))).toBe(false);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(prisma.recommendation.deleteMany).not.toHaveBeenCalled();
    expect(first.recommendations[0].id).toMatch(/^rec-/);
    expect(first.recommendations[0].liked).toBe(true);
    expect(prisma.recommendation.upsert.mock.calls[0][0].update).not.toHaveProperty('liked');
    expect((await service.getRecommendations({ ...dto, page: 4 })).recommendations).toEqual([]);
  });

  it('never reads another user’s viewed history or fallback rows', async () => {
    await internal.getFallbackRecommendations(mood(), { moodId: 'mood' });
    expect(prisma.recommendation.findMany.mock.calls[0][0].where.userId).toBe('anonymous');
    prisma.recommendation.findUnique.mockResolvedValue({ id: 'rec', userId: 'bob' });
    await expect(service.provideFeedback({ recommendationId: 'rec' }, 'alice')).rejects.toThrow('Recommendation not found');
    expect(prisma.recommendation.update).not.toHaveBeenCalled();
  });

  it('uses a bounded Discover/keyword-ID pool instead of title searches or translation passes', async () => {
    await internal.fetchCandidates(mood(), { moodId: 'mood' });
    const endpoints = tmdb.request.mock.calls.map(([path]) => path);
    expect(endpoints).toHaveLength(10);
    expect(endpoints.every(path => path.startsWith('discover/') || path === 'search/keyword')).toBe(true);
    expect(endpoints.some(path => path.includes('vote_average.desc'))).toBe(true);
    expect(endpoints.every(path => !path.includes('ko-KR'))).toBe(true);
  });

  it('preserves matched keyword evidence when a title appears in multiple sources', () => {
    const result = internal.removeDuplicateContent([candidate(), { ...candidate(), keywords: ['friendship'] }]);
    expect(result).toHaveLength(1);
    expect(result[0].keywords).toEqual(['friendship']);
  });

  it('returns a retryable error when all upstream sources fail and no fallback exists', async () => {
    tmdb.request.mockRejectedValue(new Error('TMDB unavailable'));
    await expect(service.getRecommendations({ moodId: 'mood' })).rejects.toThrow('temporarily unavailable');
  });
});
