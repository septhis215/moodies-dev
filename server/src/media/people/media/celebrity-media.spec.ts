import { ConfigService } from '@nestjs/config';
import { PeopleService } from '../people.service';
import { RedisService } from 'src/redis/redis.service';
import { CelebrityIdentityService } from './celebrity-identity.service';
import { CelebrityMediaService } from './celebrity-media.service';
import { MediaCacheService } from './media-cache.service';
import { MediaHttpService, MediaProviderError } from './media-http.service';
import { YoutubeMediaProvider } from './youtube-media.provider';
import { TmdbMediaProvider } from './tmdb-media.provider';
import { WikimediaMediaProvider } from './wikimedia-media.provider';
import { OpenverseMediaProvider } from './openverse-media.provider';
import {
  dedupePhotos,
  dedupeVideos,
  identityRelevance,
  videoCategory,
} from './celebrity-media.types';
import type {
  CelebrityIdentity,
  CelebrityPhoto,
  CelebrityVideo,
} from './celebrity-media.types';

const woni: CelebrityIdentity = {
  id: 123,
  name: 'Woni',
  aliases: ['Woni', 'Won-i', '워니'],
  contexts: ['RESCENE'],
  department: 'Acting',
  officialChannelIds: ['UCabcdefghijklmnopqrstuv'],
};
const actor: CelebrityIdentity = {
  ...woni,
  id: 31,
  name: 'Tom Hanks',
  aliases: ['Tom Hanks'],
  contexts: ['Forrest Gump'],
  officialChannelIds: [],
};
const actress: CelebrityIdentity = {
  ...actor,
  id: 224513,
  name: 'Ana de Armas',
  aliases: ['Ana de Armas'],
  contexts: ['Knives Out'],
};
const redisMock = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  rateLimitHit: jest.fn().mockResolvedValue({ count: 1, ttlMs: 86400000 }),
});
const photo = (url: string, hash?: string): CelebrityPhoto => ({
  id: url,
  url,
  thumbnail: url,
  title: 'Woni portrait',
  width: 1000,
  height: 1500,
  source: 'tmdb',
  sourceUrl: 'https://www.themoviedb.org/person/123',
  attribution: 'TMDB',
  license: 'TMDB image',
  relevanceScore: 0.9,
  contentHash: hash,
});
const video = (
  id = 'abcdefghijk',
  title = 'Woni RESCENE interview',
  score = 0.8,
): CelebrityVideo => ({
  id,
  title,
  thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
  channel: 'Example',
  publishedAt: null,
  duration: null,
  category: 'interview',
  source: 'youtube',
  url: `https://www.youtube.com/watch?v=${id}`,
  official: false,
  relevanceScore: score,
  canEmbed: true,
});
const youtubeItem = (title: string, id = 'abcdefghijk', extra = {}) => ({
  id,
  snippet: {
    title,
    channelTitle: 'RESCENE official',
    channelId: 'UCabcdefghijklmnopqrstuv',
    publishedAt: '2025-01-01',
    thumbnails: {
      high: { url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' },
    },
  },
  status: {
    privacyStatus: 'public',
    embeddable: true,
    uploadStatus: 'processed',
  },
  contentDetails: { duration: 'PT3M20S' },
  ...extra,
});

describe('celebrity media relevance and deduplication', () => {
  it('requires the individual name plus context; keeps multilingual aliases', () => {
    expect(identityRelevance(woni, 'Woni cooking tips')).toBe(0);
    expect(identityRelevance(woni, 'Another Woni interview')).toBe(0);
    expect(identityRelevance(woni, 'RESCENE performance')).toBe(0);
    expect(identityRelevance(woni, 'Woni RESCENE performance')).toBeGreaterThan(
      0.9,
    );
    expect(identityRelevance(woni, 'Won-i RESCENE interview')).toBeGreaterThan(
      0.9,
    );
    expect(identityRelevance(woni, '워니 RESCENE 직캠')).toBeGreaterThan(0.9);
    expect(identityRelevance(actor, 'Tom Hanks interview')).toBe(0);
    expect(
      identityRelevance(actor, 'Tom Hanks interview', 'Forrest Gump star'),
    ).toBeGreaterThan(0.9);
    expect(
      identityRelevance(actress, 'Ana de Armas Knives Out interview'),
    ).toBeGreaterThan(0.9);
  });
  it('collapses original/thumbnail URLs and image SHA1 duplicates', () => {
    expect(
      dedupePhotos([
        photo('https://image.tmdb.org/t/p/w500/a.jpg'),
        photo('https://image.tmdb.org/t/p/original/a.jpg'),
      ]),
    ).toHaveLength(1);
    expect(
      dedupePhotos([
        photo('https://upload.wikimedia.org/a.jpg', 'same'),
        photo('https://upload.wikimedia.org/b.jpg', 'same'),
      ]),
    ).toHaveLength(1);
  });
  it('deduplicates videos across TMDB and YouTube by ID and same-channel title', () => {
    const deduped = dedupeVideos([
      { ...video(), duration: 'PT3M20S' },
      {
        ...video(),
        source: 'tmdb',
        official: true,
        relevanceScore: 0.9,
        canEmbed: false,
      },
      video('lmnopqrstuv'),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].source).toBe('tmdb');
    expect(deduped[0]).toMatchObject({ canEmbed: true, duration: 'PT3M20S' });
  });
  it.each([
    ['Woni RESCENE 직캠', 'fancam'],
    ['Official MV', 'music-video'],
    ['Interview', 'interview'],
    ['Behind the scenes', 'behind-scenes'],
  ])('categorizes %s', (title, category) => {
    expect(videoCategory(title)).toBe(category);
  });
});

describe('media cache', () => {
  afterEach(() => jest.useRealTimers());
  it('coalesces concurrent cache misses and survives Redis failures', async () => {
    const redis = redisMock();
    redis.get.mockRejectedValue(new Error('Redis offline'));
    redis.set.mockRejectedValue(new Error('Redis offline'));
    const cache = new MediaCacheService(redis as unknown as RedisService);
    const load = jest.fn().mockResolvedValue({ photos: [] });
    await Promise.all([
      cache.get('same', 60, load),
      cache.get('same', 60, load),
    ]);
    await cache.get('same', 60, load);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('serves stale media during outages and stops repeated failing requests', async () => {
    jest.useFakeTimers();
    const cache = new MediaCacheService(redisMock() as unknown as RedisService);
    await cache.get('stale', 60, async () => 'usable media');
    jest.advanceTimersByTime(61000);
    const fail = jest.fn().mockRejectedValue(new Error('quota'));
    expect(await cache.get('stale', 60, fail)).toEqual({
      value: 'usable media',
      stale: true,
    });
    expect(await cache.get('stale', 60, fail)).toEqual({
      value: 'usable media',
      stale: true,
    });
    expect(fail).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(8 * 86400000);
    await expect(cache.get('stale', 60, fail)).rejects.toThrow('quota');
  });
});

describe('YouTube provider', () => {
  function setup(items: unknown[], config: Record<string, unknown> = {}) {
    const http = {
      json: jest
        .fn()
        .mockResolvedValueOnce({
          items: items.map((_, i) => ({
            id: { videoId: `video${String(i).padStart(6, '0')}` },
          })),
        })
        .mockResolvedValueOnce({ items }),
    };
    const redis = redisMock();
    const provider = new YoutubeMediaProvider(
      new ConfigService({ YOUTUBE_API_KEY: 'test-only', ...config }),
      http as unknown as MediaHttpService,
      redis as unknown as RedisService,
    );
    return { provider, http, redis };
  }
  it('removes private/deleted/nonembeddable/unrelated videos and reports duration', async () => {
    const { provider } = setup([
      youtubeItem('Woni RESCENE performance'),
      youtubeItem('Woni recipes', 'different01', {
        snippet: { title: 'Woni recipes', channelId: 'unconfirmed' },
      }),
      youtubeItem('Woni RESCENE private', 'different02', {
        status: { privacyStatus: 'private', embeddable: true },
      }),
      youtubeItem('Woni RESCENE disabled', 'different03', {
        status: { privacyStatus: 'public', embeddable: false },
      }),
    ]);
    const result = await provider.discover(woni);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toMatchObject({
      duration: 'PT3M20S',
      official: true,
      category: 'performance',
    });
  });
  it('does not trust official text in channel names and removes regional blocks', async () => {
    const { provider } = setup(
      [
        youtubeItem('Woni RESCENE interview', 'abcdefghijk', {
          snippet: {
            title: 'Woni RESCENE interview',
            channelTitle: 'Official',
            channelId: 'not-confirmed',
            thumbnails: { high: { url: 'https://i.ytimg.com/example.jpg' } },
          },
        }),
        youtubeItem('Woni RESCENE live', 'lmnopqrstuv', {
          contentDetails: { regionRestriction: { blocked: ['MY'] } },
        }),
      ],
      { YOUTUBE_REGION_CODE: 'MY' },
    );
    expect((await provider.discover(woni)).videos).toMatchObject([
      { official: false },
    ]);
  });
  it('does nothing without a server key', async () => {
    const { provider, http } = setup([], { YOUTUBE_API_KEY: '' });
    expect((await provider.discover(woni)).videos).toEqual([]);
    expect(http.json).not.toHaveBeenCalled();
  });
  it('matches a short stage name on a confirmed channel without a group context', async () => {
    const { provider } = setup([youtubeItem('Woni interview')]);
    expect(
      (await provider.discover({ ...woni, contexts: [] })).videos,
    ).toHaveLength(1);
  });
  it('links out child-directed videos and does not create YouTube popularity metrics', async () => {
    const { provider } = setup([
      youtubeItem('Woni RESCENE live', 'abcdefghijk', {
        status: {
          privacyStatus: 'public',
          embeddable: true,
          uploadStatus: 'processed',
          madeForKids: true,
        },
      }),
    ]);
    const result = await provider.discover(woni);
    expect(result.videos[0].canEmbed).toBe(false);
    expect(result.videos[0].relevanceScore).toBeUndefined();
  });
  it('stops discovery when the shared daily budget is exhausted', async () => {
    const { provider, http, redis } = setup([]);
    redis.rateLimitHit.mockResolvedValue({ count: 61, ttlMs: 86400000 });
    await expect(provider.discover(woni)).rejects.toThrow(
      'daily discovery budget',
    );
    expect(http.json).not.toHaveBeenCalled();
  });
  it('shares quota cooldown in Redis and never exposes API keys in errors', async () => {
    const { provider, http, redis } = setup([]);
    http.json.mockReset().mockRejectedValue(new MediaProviderError(403));
    await expect(provider.discover(woni)).rejects.toThrow(
      'Media provider returned 403',
    );
    await expect(provider.discover(woni)).rejects.toThrow('quota cooldown');
    expect(http.json).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      'celebrity:youtube:cooldown',
      '1',
      3600,
    );
  });
});

describe('celebrity identity resolution', () => {
  it('uses TMDB biography group context and rejects conflicting Wikidata identifiers', async () => {
    const people = {
      getPersonDetails: jest.fn().mockResolvedValue({
        id: 123,
        name: 'Woni',
        biography: 'Woni is a member of the South Korean girl group RESCENE.',
        also_known_as: ['Won-i'],
        external_ids: { imdb_id: 'nm16380468' },
      }),
    };
    const http = {
      json: jest.fn().mockResolvedValue({
        results: {
          bindings: [
            { person: { value: 'http://www.wikidata.org/entity/Q1' } },
            { person: { value: 'http://www.wikidata.org/entity/Q2' } },
          ],
        },
      }),
    };
    const resolver = new CelebrityIdentityService(
      people as unknown as PeopleService,
      new MediaCacheService(redisMock() as unknown as RedisService),
      http as unknown as MediaHttpService,
      new ConfigService(),
    );
    const identity = await resolver.resolve(123);
    expect(identity.contexts).toContain('RESCENE');
    expect(identity.aliases).toContain('Won-i');
    expect(identity.wikidataId).toBeUndefined();
    expect(http.json.mock.calls[0][0].searchParams.get('query')).toContain(
      'wdt:P4985 "123"',
    );
  });
  it.each([actor, actress])(
    'resolves exact identifiers and photo credits for $name',
    async (profile) => {
      const people = {
        getPersonDetails: jest.fn().mockResolvedValue({
          id: profile.id,
          name: profile.name,
          also_known_as: profile.aliases,
          combined_credits: { cast: [{ title: profile.contexts[0] }] },
        }),
      };
      const http = {
        json: jest.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                person: { value: 'http://www.wikidata.org/entity/Q123' },
                category: { value: profile.name },
              },
            ],
          },
        }),
      };
      const resolver = new CelebrityIdentityService(
        people as unknown as PeopleService,
        new MediaCacheService(redisMock() as unknown as RedisService),
        http as unknown as MediaHttpService,
        new ConfigService(),
      );
      expect(await resolver.resolve(profile.id)).toMatchObject({
        name: profile.name,
        contexts: profile.contexts,
        wikidataId: 'Q123',
        commonsCategory: profile.name,
      });
    },
  );
});

describe('Wikimedia provider', () => {
  it('requires exact identity linkage and licensed, relevant high-resolution photographs', async () => {
    const info = {
      url: 'https://upload.wikimedia.org/woni.jpg',
      thumburl: 'https://upload.wikimedia.org/thumb/woni.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Woni.jpg',
      width: 1200,
      height: 1800,
      mime: 'image/jpeg',
      sha1: 'abc',
      extmetadata: {
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        Artist: { value: '<a>Photographer</a>' },
      },
    };
    const http = {
      json: jest.fn().mockResolvedValue({
        query: {
          pages: [
            {
              pageid: 1,
              title: 'File:Woni RESCENE event.jpg',
              imageinfo: [info],
            },
            { pageid: 2, title: 'File:RESCENE logo.png', imageinfo: [info] },
            {
              pageid: 3,
              title: 'File:Woni RESCENE group photo.jpg',
              imageinfo: [info],
            },
            {
              pageid: 4,
              title: 'File:Woni RESCENE portrait.jpg',
              imageinfo: [{ ...info, width: 100 }],
            },
            {
              pageid: 5,
              title: 'File:Woni RESCENE portrait.jpg',
              imageinfo: [
                {
                  ...info,
                  extmetadata: {
                    LicenseShortName: { value: 'All rights reserved' },
                  },
                },
              ],
            },
          ],
        },
      }),
    };
    const provider = new WikimediaMediaProvider(
      http as unknown as MediaHttpService,
    );
    expect((await provider.discover(woni)).photos).toHaveLength(0);
    expect(http.json).not.toHaveBeenCalled();
    const result = await provider.discover({ ...woni, wikidataId: 'Q123' });
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]).toMatchObject({
      attribution: 'Photographer',
      license: 'CC BY-SA 4.0',
      contentHash: 'abc',
    });
  });
});

describe('media aggregation', () => {
  it('returns TMDB photos when other providers fail and caches the partial response', async () => {
    const identity = { resolve: jest.fn().mockResolvedValue(woni) };
    const cache = new MediaCacheService(redisMock() as unknown as RedisService);
    const tmdb = {
      discover: jest.fn().mockResolvedValue({
        photos: [photo('https://image.tmdb.org/t/p/original/a.jpg')],
        videos: [video()],
      }),
    };
    const youtube = {
      enabled: true,
      discover: jest.fn().mockRejectedValue(new Error('quota')),
    };
    const wikimedia = {
      discover: jest.fn().mockRejectedValue(new Error('timeout')),
    };
    const service = new CelebrityMediaService(
      identity as unknown as CelebrityIdentityService,
      cache,
      tmdb as unknown as TmdbMediaProvider,
      youtube as unknown as YoutubeMediaProvider,
      wikimedia as unknown as WikimediaMediaProvider,
      new ConfigService(),
      {
        discover: jest.fn().mockResolvedValue({ photos: [], videos: [] }),
      } as unknown as OpenverseMediaProvider,
    );
    const result = await service.getMedia(123);
    expect(result).toMatchObject({
      totalPhotos: 1,
      totalVideos: 1,
      sources: {
        tmdb: 'ready',
        youtube: 'unavailable',
        wikimedia: 'unavailable',
      },
    });
    await service.getMedia(123);
    expect(identity.resolve).toHaveBeenCalledTimes(1);
    expect(youtube.discover).toHaveBeenCalledTimes(1);
  });
});
