import { TrendingService } from './trending.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { RedisService } from 'src/redis/redis.service';
import { ContentFilterService } from '../filters/content-filter.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { PrismaService } from 'src/prisma/prisma.service';

function setup(
  watchlistItems: { tmdbId: number; mediaType: 'MOVIE' | 'TV' }[] = [],
) {
  const candidates = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    title: `Candidate ${index + 1}`,
    genre_ids: [18],
    original_language: 'en',
    vote_average: 8,
    vote_count: 100,
    popularity: 100,
    release_date: '2026-01-01',
  }));
  const client = {
    token: 'fixture',
    baseUrl: 'https://example.test',
    genreMap: { 18: 'Drama' },
    tmdb: jest.fn().mockResolvedValue({ results: candidates, total_pages: 1 }),
    withConcurrencyLimit: async (tasks: (() => Promise<unknown>)[]) =>
      Promise.all(tasks.map((task) => task())),
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        preferredGenres: ['Drama'],
        preferredLanguages: ['English'],
        age: 25,
        watchlistItems,
      }),
    },
  };
  return new TrendingService(
    client as unknown as TmdbClientService,
    {} as RedisService,
    {
      filterAdultishContent: (items: unknown[]) => items,
    } as ContentFilterService,
    {
      getSmartRecommendations: jest.fn().mockResolvedValue([]),
    } as unknown as RecommendationsService,
    prisma as unknown as PrismaService,
  );
}

describe('curated favorites', () => {
  it('excludes saved titles before ranking, keeping movie and TV identities separate', async () => {
    const service = setup([
      { tmdbId: 1, mediaType: 'MOVIE' },
      { tmdbId: 2, mediaType: 'TV' },
    ]);
    const result = await service.getFavorites('member', 4);
    const keys = result.map((item) => `${item.type}:${item.id}`);
    expect(result).toHaveLength(4);
    expect(keys).not.toContain('movie:1');
    expect(keys).not.toContain('tv:2');
    expect(keys).toContain('tv:1');
    expect(keys).toContain('movie:2');
    expect(new Set(keys).size).toBe(4);
  });

  it('fills the requested mix from unsaved candidates beyond the original top picks', async () => {
    const saved = [1, 2, 3, 4, 5, 6].flatMap((tmdbId) => [
      { tmdbId, mediaType: 'MOVIE' as const },
      { tmdbId, mediaType: 'TV' as const },
    ]);
    const result = await setup(saved).getFavorites('member', 4);
    expect(result).toHaveLength(4);
    expect(result.every((item) => item.id === 7 || item.id === 8)).toBe(true);
  });

  it('returns an empty mix when all available titles are already saved', async () => {
    const saved = Array.from({ length: 8 }, (_, i) => i + 1).flatMap(
      (tmdbId) => [
        { tmdbId, mediaType: 'MOVIE' as const },
        { tmdbId, mediaType: 'TV' as const },
      ],
    );
    expect(await setup(saved).getFavorites('member', 4)).toEqual([]);
  });
});
