import { PeopleService } from './people.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';

const person = (id: number) => ({
  id,
  name: `Actor ${id}`,
  profile_path: '/portrait.jpg',
  popularity: 50,
  known_for_department: 'Acting',
  gender: 2,
  known_for: [1, 2].map((credit) => ({
    id: credit,
    title: `Mainstream film ${credit}`,
    media_type: 'movie',
    poster_path: '/poster.jpg',
    popularity: 30,
    vote_count: 500,
    vote_average: 8,
    release_date: '2020-01-01',
  })),
});

function harness(source: (page: number) => unknown) {
  const request = jest.fn(async (path: string) => {
    if (path.includes('combined_credits')) return { cast: [] };
    return source(
      Number(new URL(path, 'https://tmdb.test').searchParams.get('page')),
    );
  });
  const redis = { getOrSet: jest.fn(async (_key, _ttl, load) => load()) };
  const service = new PeopleService(
    { request } as unknown as TMDBService,
    redis as unknown as RedisService,
  );
  return {
    service,
    request,
    redis,
    sourceCalls: () =>
      request.mock.calls
        .map(([path]) => path)
        .filter((path) => !path.includes('combined_credits')),
  };
}

describe('celebrity directory pagination', () => {
  it('loads a fully qualified page with one upstream call and reuses the cached page', async () => {
    jest.useFakeTimers();
    try {
      const values = new Map<string, string>();
      const redis = new RedisService({ get: jest.fn() } as unknown as ConfigService);
      jest.spyOn(redis, 'get').mockImplementation(async key => values.get(key) ?? null);
      jest.spyOn(redis, 'set').mockImplementation(async (key, value) => { values.set(key, value); });
      const request = jest.fn(async (path: string) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return path.includes('combined_credits') ? { cast: [] } : {
          page: 1, total_pages: 12, total_results: 240,
          results: Array.from({ length: 20 }, (_, index) => person(index + 1)),
        };
      });
      const service = new PeopleService({ request } as unknown as TMDBService, redis);
      const started = Date.now();
      const pending = Promise.all([service.discoverPeople(), service.discoverPeople()]);
      await jest.runAllTimersAsync();
      const [first, concurrent] = await pending;
      const elapsed = Date.now() - started;
      console.log(`Celebrity page fixture: ${request.mock.calls.length} upstream calls, ${elapsed}ms at 100ms per upstream response`);
      expect(first.results).toHaveLength(20);
      expect(concurrent).toEqual(first);
      expect(request).toHaveBeenCalledTimes(1);
      expect(elapsed).toBeLessThanOrEqual(100);
      expect(await service.discoverPeople()).toEqual(first);
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not repeat a failed upstream fetch through the cache fallback', async () => {
    const { service, request } = harness(() => { throw new Error('TMDB unavailable'); });
    await expect(service.discoverPeople()).rejects.toThrow('TMDB unavailable');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['upstream', 'cache-read', 'cache-write'])('coalesces simultaneous requests when %s fails', async failure => {
    const redis = new RedisService({ get: jest.fn() } as unknown as ConfigService);
    jest.spyOn(redis, 'get').mockResolvedValue(null);
    if (failure === 'cache-read') jest.spyOn(redis, 'get').mockRejectedValue(new Error('Cache read failed'));
    jest.spyOn(redis, 'set').mockRejectedValue(new Error('Cache write failed'));
    const request = jest.fn(async () => {
      if (failure === 'upstream') throw new Error('TMDB unavailable');
      return { page: 1, total_pages: 1, total_results: 1, results: [person(1)] };
    });
    const service = new PeopleService({ request } as unknown as TMDBService, redis);
    const results = await Promise.allSettled([service.discoverPeople(), service.discoverPeople()]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(results.every(result => result.status === (failure === 'upstream' ? 'rejected' : 'fulfilled'))).toBe(true);
    if (failure === 'cache-write') {
      for (const result of results) {
        if (result.status === 'fulfilled') expect(result.value.results).toHaveLength(1);
      }
    }
    await Promise.allSettled([service.discoverPeople()]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('still loads the page once when Redis fails before fetching', async () => {
    const { service, redis, request } = harness(page => ({ page, total_pages: 1, total_results: 1, results: [person(1)] }));
    redis.getOrSet.mockRejectedValue(new Error('Redis unavailable'));
    expect((await service.discoverPeople()).results).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('bounds sparse-profile enrichment to 20 people in six-wide batches', async () => {
    jest.useFakeTimers();
    try {
      let active = 0;
      let peak = 0;
      const request = jest.fn(async (path: string) => {
        if (path.includes('combined_credits')) {
          active++;
          peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, 100));
          active--;
          return { cast: person(1).known_for };
        }
        return { page: 1, total_pages: 2, total_results: 40,
          results: Array.from({ length: 40 }, (_, index) => ({ ...person(index + 1), known_for: [] })) };
      });
      const redis = { getOrSet: jest.fn(async (_key, _ttl, load) => load()) };
      const service = new PeopleService({ request } as unknown as TMDBService, redis as unknown as RedisService);
      const pending = service.discoverPeople({ limit: 40 });
      await jest.runAllTimersAsync();
      expect((await pending).results).toHaveLength(20);
      expect(request).toHaveBeenCalledTimes(21);
      expect(peak).toBe(6);
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves data when cache storage fails after a successful fetch', async () => {
    const { service, redis, request } = harness(page => ({ page, total_pages: 1, total_results: 1, results: [person(1)] }));
    redis.getOrSet.mockImplementation(async (_key, _ttl, load) => {
      await load();
      throw new Error('Cache write failed');
    });
    const result = await service.discoverPeople();
    expect(result.results).toHaveLength(1);
    expect(request.mock.calls.filter(([path]) => !path.includes('combined_credits'))).toHaveLength(1);
  });

  it('still fetches credits for sparse profiles and verifies crew roles', async () => {
    const { service, request } = harness(page => ({
      page, total_pages: 1, total_results: 1,
      results: [{ ...person(1), known_for_department: 'Directing' }],
    }));
    const source = request.getMockImplementation()!;
    request.mockImplementation(async path => path.includes('combined_credits')
      ? { cast: [], crew: person(1).known_for.map(credit => ({ ...credit, id: credit.id + 100, job: 'Director' })) }
      : source(path));
    const result = await service.discoverPeople({ category: 'directors' });
    expect(result.results).toHaveLength(1);
    expect(request.mock.calls.filter(([path]) => path.includes('combined_credits'))).toHaveLength(1);
  });

  it('fetches only the requested source page without rescanning or mixing its neighbours', async () => {
    const { service, sourceCalls, redis } = harness((page) => ({
      page,
      total_pages: 12,
      total_results: 240,
      results: Array.from({ length: 20 }, (_, index) =>
        person(page * 100 + index),
      ),
    }));
    const first = await service.discoverPeople({
      category: 'popular',
      page: 1,
      limit: 20,
    });
    const second = await service.discoverPeople({
      category: 'popular',
      page: 2,
      limit: 20,
    });
    expect(sourceCalls()).toEqual([
      'person/popular?page=1',
      'person/popular?page=2',
    ]);
    expect(first.results).toHaveLength(20);
    expect(second.results).toHaveLength(20);
    expect(
      second.results.every((result) => result.id >= 200 && result.id < 220),
    ).toBe(true);
    expect(
      first.results.some((result) =>
        second.results.some((next) => next.id === result.id),
      ),
    ).toBe(false);
    expect(second).toMatchObject({
      page: 2,
      total_pages: 12,
      total_results: 240,
      has_more: true,
    });
    expect(redis.getOrSet.mock.calls[0][0]).toBe(
      'people:discover:v11:popular::1:20',
    );
  });

  it('allows pages beyond eight and reports the real final-page metadata', async () => {
    const { service, sourceCalls } = harness((page) => ({
      page,
      total_pages: 12,
      total_results: 225,
      results: [person(page * 100)],
    }));
    const result = await service.discoverPeople({
      category: 'popular',
      page: 12,
    });
    expect(sourceCalls()).toEqual(['person/popular?page=12']);
    expect(result).toMatchObject({
      page: 12,
      total_pages: 12,
      total_results: 225,
      has_more: false,
    });
    expect(result.results[0].id).toBe(1200);
  });

  it('keeps pagination available when an upstream page contains no safe matching people', async () => {
    const { service, sourceCalls, request } = harness((page) => ({
      page,
      total_pages: 12,
      total_results: 240,
      results: [
        { ...person(1), adult: true },
        {
          ...person(2),
          known_for: [
            { id: 99, title: 'Adult entertainment', media_type: 'movie' },
          ],
        },
        { ...person(3), gender: 1 },
        { ...person(4), profile_path: null },
      ],
    }));
    const result = await service.discoverPeople({
      category: 'actors',
      page: 2,
    });
    expect(result).toMatchObject({
      results: [],
      page: 2,
      total_pages: 12,
      total_results: 240,
      has_more: true,
    });
    expect(sourceCalls()).toEqual(['person/popular?page=2']);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('encodes search queries and uses the requested page with adult filtering', async () => {
    const { service, sourceCalls } = harness((page) => ({
      page,
      total_pages: 3,
      total_results: 41,
      results: [person(1)],
    }));
    const result = await service.discoverPeople({
      query: 'Tom & friends',
      category: 'actors',
      page: 2,
    });
    expect(sourceCalls()).toEqual([
      'search/person?query=Tom%20%26%20friends&page=2&include_adult=false',
    ]);
    expect(result).toMatchObject({
      page: 2,
      query: 'Tom & friends',
      source: 'search',
      has_more: true,
    });
  });

  it('bounds provider pages at 500 and does not advertise an unreachable next page', async () => {
    const { service, sourceCalls } = harness((page) => ({
      page,
      total_pages: 1000,
      total_results: 20000,
      results: [person(1)],
    }));
    const result = await service.discoverPeople({ page: 999 });
    expect(sourceCalls()).toEqual(['trending/person/week?page=500']);
    expect(result).toMatchObject({
      page: 500,
      total_pages: 500,
      has_more: false,
    });
  });
});
