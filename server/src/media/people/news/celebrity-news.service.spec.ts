import { ConfigService } from '@nestjs/config';
import { CelebrityNewsService } from './celebrity-news.service';
import { CelebrityIdentityService } from '../media/celebrity-identity.service';
import { MediaCacheService } from '../media/media-cache.service';
import { RedisService } from 'src/redis/redis.service';
import { NEWS_PUBLISHERS } from './celebrity-news';
import { PeopleService } from '../people.service';

const identity = {
  id: 31,
  name: 'Tom Hanks',
  aliases: ['Tom Hanks'],
  contexts: ['Toy Story'],
  department: 'Acting',
  officialChannelIds: [],
};
function setup() {
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const cache = new MediaCacheService(redis as unknown as RedisService);
  const resolver = { resolve: jest.fn().mockResolvedValue(identity) };
  const people = {
    searchPeople: jest
      .fn()
      .mockResolvedValue({ results: [{ id: 31, name: 'Tom Hanks' }] }),
  };
  const service = new CelebrityNewsService(
    resolver as unknown as CelebrityIdentityService,
    cache,
    new ConfigService(),
    people as unknown as PeopleService,
  );
  return { cache, service, redis, resolver, people };
}
function response(origin: string) {
  return new Response(
    `<rss><channel><item><title>Tom Hanks returns to Toy Story</title><link>${origin}/2026/news/story/</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`,
    { headers: { 'content-type': 'application/rss+xml' } },
  );
}
describe('CelebrityNewsService', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
    jest.restoreAllMocks();
  });
  it('requires a known work when TMDB identifies people with the same name', async () => {
    const { service, people } = setup();
    people.searchPeople.mockResolvedValue({
      results: [
        { id: 31, name: 'Tom Hanks' },
        { id: 99, name: 'Tom Hanks' },
      ],
    });
    global.fetch = jest
      .fn()
      .mockImplementation((url: URL) =>
        Promise.resolve(
          new Response(
            `<rss><channel><item><title>Tom Hanks returns to television</title><link>${url.origin}/2026/news/story/</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`,
            { headers: { 'content-type': 'application/rss+xml' } },
          ),
        ),
      );
    expect((await service.getNews(31)).articles).toEqual([]);
  });
  it('coalesces concurrent requests, caches per source and survives Redis failure', async () => {
    const { service, redis } = setup();
    redis.get.mockRejectedValue(new Error('offline'));
    redis.set.mockRejectedValue(new Error('offline'));
    const fetcher = jest
      .fn()
      .mockImplementation((url: URL) => Promise.resolve(response(url.origin)));
    global.fetch = fetcher;
    const [first, second] = await Promise.all([
      service.getNews(),
      service.getNews(),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(first).toEqual(second);
    expect(first.sources.every((source) => source.status === 'ready')).toBe(
      true,
    );
    expect(first.articles).toHaveLength(1);
    await service.getNews();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('uses fixed topic URLs and returns partial results when one provider fails', async () => {
    const { service } = setup();
    const fetcher = jest
      .fn()
      .mockImplementation((url: URL) =>
        url.hostname === 'deadline.com'
          ? Promise.reject(new Error('timeout'))
          : Promise.resolve(response(url.origin)),
      );
    global.fetch = fetcher;
    const result = await service.getNews(31);
    expect(result.person).toEqual({ id: 31, name: 'Tom Hanks' });
    expect(result.articles).toHaveLength(1);
    expect(
      result.sources.find((source) => source.id === 'deadline'),
    ).toMatchObject({ status: 'unavailable', fetchedAt: null });
    expect(fetcher.mock.calls.map(([url]) => (url as URL).pathname)).toEqual(
      expect.arrayContaining(['/t/tom-hanks/feed/', '/tag/tom-hanks/feed/']),
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it('preserves snapshot timestamps during outages and refuses snapshots after six hours', async () => {
    const { service, cache } = setup();
    const fetchedAt = new Date().toISOString();
    for (const publisher of NEWS_PUBLISHERS) {
      await cache.remember(
        `celebrity:news:v1:${publisher.id}:all`,
        { articles: [], fetchedAt },
        -1,
        6 * 3600,
      );
    }
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const stale = await service.getNews();
    expect(
      stale.sources.every(
        (source) => source.status === 'stale' && source.fetchedAt === fetchedAt,
      ),
    ).toBe(true);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 7 * 3600000);
    const expired = await service.getNews();
    expect(
      expired.sources.every(
        (source) =>
          source.status === 'unavailable' && source.fetchedAt === null,
      ),
    ).toBe(true);
  });
  it('rejects invalid IDs before resolving identity or fetching feeds', async () => {
    const { service, resolver } = setup();
    for (const id of [-1, 0, 1.5, NaN])
      await expect(service.getNews(id)).rejects.toThrow('Invalid person ID');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });
  it('does not cache HTML, malformed feeds or oversized response bodies as successful news', async () => {
    for (const [body, contentType] of [
      ['<html/>', 'text/html'],
      ['<rss>', 'application/xml'],
      ['x'.repeat(512 * 1024 + 1), 'application/xml'],
    ]) {
      const { service } = setup();
      global.fetch = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(body, { headers: { 'content-type': contentType } }),
          ),
        );
      const result = await service.getNews();
      expect(result.articles).toEqual([]);
      expect(
        result.sources.every((source) => source.status === 'unavailable'),
      ).toBe(true);
    }
  });
});
