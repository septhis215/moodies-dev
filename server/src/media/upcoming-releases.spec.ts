import { ServiceUnavailableException } from '@nestjs/common';
import { MovieTrailersService } from './movies/trailers/movie-trailers.service';
import { TvTrailersService } from './tv/trailers/tv-trailers.service';

describe.each(['movie', 'tv'] as const)('%s upcoming-release recovery', (type) => {
  const setup = () => {
    const cache = new Map<string, unknown>();
    const client = {
      token: 'fixture', genreMap: {},
      tmdb: jest.fn().mockResolvedValue({ results: [] }),
      withConcurrencyLimit: jest.fn(async (tasks: Array<() => Promise<unknown>>) => Promise.all(tasks.map(task => task()))),
    };
    const redis = { getOrSet: jest.fn(async (key: string, _ttl: number, fetcher: () => Promise<unknown>, shouldCache: (value: unknown) => boolean) => {
      if (cache.has(key)) return cache.get(key);
      const result = await fetcher();
      if (shouldCache(result)) cache.set(key, result);
      return result;
    }) };
    const service = type === 'tv'
      ? new TvTrailersService(client as unknown as ConstructorParameters<typeof TvTrailersService>[0], {} as ConstructorParameters<typeof TvTrailersService>[1], redis as unknown as ConstructorParameters<typeof TvTrailersService>[2])
      : new MovieTrailersService(client as unknown as ConstructorParameters<typeof MovieTrailersService>[0], {} as ConstructorParameters<typeof MovieTrailersService>[1], {} as ConstructorParameters<typeof MovieTrailersService>[2], redis as unknown as ConstructorParameters<typeof MovieTrailersService>[3]);
    return { service, client, cache };
  };

  it('does not cache or repeat a failed provider build as a cache bypass', async () => {
    const { service, client, cache } = setup();
    client.withConcurrencyLimit.mockRejectedValueOnce(new Error('TMDB timeout'));
    await expect(service.getUpcomingTrailers(60)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(client.withConcurrencyLimit).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
    await expect(service.getUpcomingTrailers(60)).resolves.toEqual([]);
  });

  it('preserves a legitimate empty catalogue without caching it', async () => {
    const { service, cache } = setup();
    await expect(service.getUpcomingTrailers(60)).resolves.toEqual([]);
    expect(cache.size).toBe(0);
  });

  it('serves a successful build from cache on the next request', async () => {
    const { service, client, cache } = setup();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    client.tmdb.mockResolvedValue({ results: [{ id: 42, poster_path: '/poster.jpg', release_date: tomorrow, first_air_date: tomorrow }] });
    const initial = await service.getUpcomingTrailers(60);
    expect(initial.map(item => item.id)).toEqual([42]);
    const calls = client.tmdb.mock.calls.length;
    expect(cache.size).toBe(1);
    await expect(service.getUpcomingTrailers(60)).resolves.toEqual(initial);
    expect(client.tmdb).toHaveBeenCalledTimes(calls);
  });
});
