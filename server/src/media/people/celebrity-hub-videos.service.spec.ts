import {
  selectHubVideos,
  CelebrityHubVideosService,
} from './celebrity-hub-videos.service';
import { CelebrityHubService } from './celebrity-hub.service';
import { PeopleService } from './people.service';
import { YoutubeMediaProvider } from './media/youtube-media.provider';
import { MediaCacheService } from './media/media-cache.service';
import { RedisService } from 'src/redis/redis.service';
import type { CelebrityVideo } from './media/celebrity-media.types';

const video = (
  index: number,
  extra: Partial<CelebrityVideo> = {},
): CelebrityVideo => ({
  id: `video${String(index).padStart(6, '0')}`,
  title: `Interview ${index}`,
  thumbnail: 'https://i.ytimg.com/test.jpg',
  channel: 'Publisher',
  publishedAt: new Date(Date.now() - index * 60000).toISOString(),
  duration: null,
  category: 'interview',
  source: 'youtube',
  url: 'https://www.youtube.com/watch?v=abcdefghijk',
  official: false,
  canEmbed: true,
  ...extra,
});
describe('hub video feed', () => {
  it('caps ten distinct recent videos, prefers YouTube, and rejects undated/future material', () => {
    const selected = selectHubVideos([
      video(1, { source: 'tmdb' }),
      ...Array.from({ length: 14 }, (_, i) => video(i)),
      video(99, { publishedAt: null }),
      video(98, { publishedAt: new Date(Date.now() + 86400000).toISOString() }),
      video(97, { publishedAt: '2020-01-01' }),
    ]);
    expect(selected).toHaveLength(10);
    expect(new Set(selected.map((entry) => entry.id)).size).toBe(10);
    expect(selected.every((entry) => entry.source === 'youtube')).toBe(true);
    expect(selected[0].id).toBe(video(0).id);
  });

  function setup() {
    const work = { id: 101, title: 'Example film', media_type: 'movie' };
    const hub = {
      getHub: jest.fn().mockResolvedValue({
        people: [
          {
            id: 31,
            name: 'Tom Hanks',
            known_for_department: 'Acting',
            known_for: [work],
          },
        ],
      }),
    };
    const people = {
      getHubTitleVideos: jest.fn().mockResolvedValue([
        {
          key: 'abcdefghijk',
          name: 'Trailer',
          site: 'YouTube',
          official: true,
          published_at: new Date().toISOString(),
        },
      ]),
    };
    const youtube = {
      cacheVersion: 'first',
      enabled: true,
      verify: jest
        .fn()
        .mockImplementation(async (videos: CelebrityVideo[]) =>
          videos.map((entry) => ({
            ...entry,
            canEmbed: true,
            channelId: 'studio',
          })),
        ),
      discover: jest.fn().mockResolvedValue({ videos: [], photos: [] }),
    };
    const cache = new MediaCacheService({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    } as unknown as RedisService);
    return {
      hub,
      people,
      youtube,
      service: new CelebrityHubVideosService(
        hub as unknown as CelebrityHubService,
        people as unknown as PeopleService,
        youtube as unknown as YoutubeMediaProvider,
        cache,
      ),
    };
  }
  it('shares concurrent loads, keeps exact title IDs and refreshes after key rotation', async () => {
    const { service, people, youtube } = setup();
    const [feed] = await Promise.all([
      service.getVideos(),
      service.getVideos(),
    ]);
    expect(feed.videos[0]).toMatchObject({
      canEmbed: true,
      content: { id: 101, mediaType: 'movie', title: 'Example film' },
    });
    expect(people.getHubTitleVideos).toHaveBeenCalledTimes(1);
    expect(youtube.discover).toHaveBeenCalledTimes(1);
    youtube.cacheVersion = 'replacement';
    await service.getVideos();
    expect(people.getHubTitleVideos).toHaveBeenCalledTimes(2);
  });
  it('retains TMDB links when YouTube fails and reports the actual failed source', async () => {
    const { service, youtube } = setup();
    youtube.discover.mockRejectedValue(new Error('restricted key'));
    youtube.verify.mockRejectedValue(new Error('restricted key'));
    const feed = await service.getVideos();
    expect(feed.videos).toHaveLength(1);
    expect(feed.sources).toEqual({ youtube: 'unavailable', tmdb: 'ready' });
    expect(feed.videos[0].canEmbed).toBe(false);
  });
  it('features discovered uploads only with a credited work and established title channel', async () => {
    const { service, youtube } = setup();
    youtube.discover.mockResolvedValue({
      photos: [],
      videos: [
        video(1, {
          channelId: 'studio',
          content: { id: 101, title: 'Example film', mediaType: 'movie' },
        }),
        video(2, {
          channelId: 'fan',
          content: { id: 101, title: 'Example film', mediaType: 'movie' },
        }),
        video(3, { channelId: 'studio' }),
      ],
    });
    const feed = await service.getVideos();
    expect(feed.videos.map((entry) => entry.id)).toEqual([
      video(1).id,
      'abcdefghijk',
    ]);
  });
  it('does not report a successful YouTube source when an empty verification made no request', async () => {
    const { service, people, youtube } = setup();
    people.getHubTitleVideos.mockRejectedValue(new Error('offline'));
    youtube.discover.mockRejectedValue(new Error('offline'));
    expect(await service.getVideos()).toMatchObject({
      status: 'unavailable',
      sources: { tmdb: 'unavailable', youtube: 'unavailable' },
    });
  });
});
