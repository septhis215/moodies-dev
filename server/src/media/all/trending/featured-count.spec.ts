import { TrendingService } from './trending.service';
import { MovieCatalogService } from '../../movies/catalog/movie-catalog.service';
import { TvCatalogService } from '../../tv/catalog/tv-catalog.service';
import { AllController } from '../all.controller';

const titles = (start: number, length: number, type: 'movie' | 'tv') =>
  Array.from({ length }, (_, i) => ({
    id: start + i,
    ...(type === 'movie' ? { title: `Movie ${start + i}` } : { name: `TV ${start + i}` }),
    genre_ids: [18],
    release_date: new Date().toISOString().slice(0, 10),
    first_air_date: new Date().toISOString().slice(0, 10),
  }));

function setup(pages: (type: 'movie' | 'tv', page: number) => unknown[]) {
  const tmdb = jest.fn(async (path: string) => {
    const url = new URL(path.replace(/\s+/g, ''), 'https://fixture.test/');
    const type = url.pathname.includes('movie') ? 'movie' : 'tv';
    return { results: pages(type, Number(url.searchParams.get('page') || 1)) };
  });
  const cache = new Map<string, string>();
  const redis = {
    get: jest.fn(async key => cache.get(key)),
    set: jest.fn(async (key, value) => { cache.set(key, value); }),
    getOrSet: jest.fn(async (_key, _ttl, fetcher) => fetcher()),
  };
  const client = { token: 'fixture', genreMap: { 18: 'Drama' }, tmdb };
  const recommendations = { populateRecommendationsBackground: jest.fn() };
  return {
    all: new TrendingService(client as never, redis as never, {} as never, {} as never, {} as never),
    movies: new MovieCatalogService(client as never, {} as never, recommendations as never, redis as never),
    tv: new TvCatalogService(client as never, {} as never, recommendations as never, redis as never),
    tmdb,
  };
}

describe('25-title homepage featured feeds', () => {
  it('preserves movie/TV identities when numeric TMDB IDs overlap', async () => {
    const { all } = setup((type, page) => page === 1 ? titles(1, 20, type) : []);
    const result = await all.getFeatured(25);
    expect(result).toHaveLength(25);
    expect(new Set(result.map(item => `${item.type}:${item.id}`)).size).toBe(25);
    expect(result.some(item => item.type === 'movie')).toBe(true);
    expect(result.some(item => item.type === 'tv')).toBe(true);
  });

  it('a smaller cached request does not truncate the landing hero', async () => {
    const { all } = setup((type, page) => page === 1 ? titles(type === 'movie' ? 1 : 101, 20, type) : []);
    expect(await all.getFeatured(8)).toHaveLength(8);
    expect(await all.getFeatured(25)).toHaveLength(25);
  });

  it('fills a sparse mixed first page from bounded subsequent pages', async () => {
    const { all } = setup((type, page) => page <= 3 ? titles(page * 10, 5, type) : []);
    expect(await all.getFeatured(25)).toHaveLength(25);
  });

  it.each(['movies', 'tv'] as const)('%s keeps fetching until there are 25 distinct titles', async kind => {
    const service = setup((type, page) => page <= 3 ? titles(page <= 2 ? 1 : 21, page === 3 ? 15 : 20, type) : [])[kind];
    const result = await service.getFeatured(25);
    expect(Array.isArray(result)).toBe(true);
    expect((result as { id: number }[]).slice(0, 25)).toHaveLength(25);
    expect(new Set((result as { id: number }[]).map(item => item.id)).size).toBeGreaterThanOrEqual(25);
  });

  it('returns fewer real results rather than padding or requesting indefinitely', async () => {
    const { all, tmdb } = setup((type, page) => page === 1 ? titles(1, 3, type) : []);
    expect(await all.getFeatured(25)).toHaveLength(6);
    expect(tmdb.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('the primary TV trending feed supplies 25 distinct recent titles', async () => {
    const { tv } = setup((type, page) => page <= 3 ? titles(page <= 2 ? 1 : 21, page === 3 ? 15 : 20, type) : []);
    const result = await tv.getTrending(25);
    expect(Array.isArray(result)).toBe(true);
    const items = result as { id: number; type: string }[];
    expect(items.slice(0, 25)).toHaveLength(25);
    expect(new Set(items.map(item => item.id)).size).toBeGreaterThanOrEqual(25);
    expect(items.every(item => item.type === 'tv')).toBe(true);
  });

  it('keeps available titles when a later upstream page fails', async () => {
    const { all } = setup((type, page) => {
      if (page > 1) throw new Error('Upstream unavailable');
      return titles(1, 5, type);
    });
    expect(await all.getFeatured(25)).toHaveLength(10);
  });

  it('parses the landing hero limit as decimal', async () => {
    const getFeatured = jest.fn().mockResolvedValue([]);
    const controller = new AllController({ getFeatured } as never, {} as never);
    await controller.featured('25');
    expect(getFeatured).toHaveBeenCalledWith(25);
  });
});
