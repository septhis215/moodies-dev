import { Injectable } from '@nestjs/common';
import { CelebrityHubService } from './celebrity-hub.service';
import { PeopleService } from './people.service';
import { MediaCacheService } from './media/media-cache.service';
import { YoutubeMediaProvider } from './media/youtube-media.provider';
import { videoCategory } from './media/celebrity-media.types';
import type {
  CelebrityVideo,
  CelebrityWork,
} from './media/celebrity-media.types';

type Feed = {
  videos: CelebrityVideo[];
  sources: {
    tmdb: 'ready' | 'unavailable';
    youtube: 'ready' | 'unavailable' | 'disabled';
  };
  updatedAt: string;
};
export function selectHubVideos(videos: CelebrityVideo[], now = Date.now()) {
  const seen = new Set<string>();
  return [...videos]
    .filter((video) => {
      const time = Date.parse(video.publishedAt || '');
      return (
        /^[\w-]{11}$/.test(video.id) &&
        Number.isFinite(time) &&
        time >= now - 90 * 86400000 &&
        time <= now + 300000
      );
    })
    .sort(
      (a, b) =>
        Number(b.source === 'youtube') - Number(a.source === 'youtube') ||
        Number(b.canEmbed) - Number(a.canEmbed) ||
        Number(/#shorts\b/i.test(a.title)) -
          Number(/#shorts\b/i.test(b.title)) ||
        Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!),
    )
    .filter((video) => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    })
    .slice(0, 10);
}

@Injectable()
export class CelebrityHubVideosService {
  constructor(
    private readonly hub: CelebrityHubService,
    private readonly people: PeopleService,
    private readonly youtube: YoutubeMediaProvider,
    private readonly cache: MediaCacheService,
  ) {}

  async getVideos() {
    try {
      const result = await this.cache.get<Feed>(
        `celebrity:hub:videos:v2:${this.youtube.cacheVersion}`,
        (feed) =>
          feed.sources.youtube === 'unavailable' ||
          feed.sources.tmdb === 'unavailable'
            ? 300
            : 3600,
        () => this.load(),
        6 * 3600,
      );
      return {
        ...result.value,
        videos: selectHubVideos(result.value.videos),
        status: result.stale ? 'stale' : 'ready',
      };
    } catch {
      return {
        videos: [],
        status: 'unavailable',
        updatedAt: null,
        sources: {
          tmdb: 'unavailable',
          youtube: this.youtube.enabled ? 'unavailable' : 'disabled',
        },
      };
    }
  }

  private async load(): Promise<Feed> {
    const hub = await this.hub.getHub();
    if (!hub.people.length) throw new Error('Hub credits unavailable');
    const works = new Map<string, CelebrityWork>();
    const featured: Array<{
      person: (typeof hub.people)[number];
      work: CelebrityWork;
    }> = [];
    for (const person of hub.people) {
      for (const credit of person.known_for || []) {
        const key = `${credit.media_type}:${credit.id}`;
        if (works.has(key)) continue;
        const work: CelebrityWork = {
          id: credit.id,
          mediaType: credit.media_type,
          title: credit.title,
          posterPath: credit.poster_path,
          backdropPath: credit.backdrop_path,
        };
        works.set(key, work);
        featured.push({ person, work });
      }
    }
    const sources: Feed['sources'] = {
      tmdb: 'unavailable',
      youtube: this.youtube.enabled ? 'unavailable' : 'disabled',
    };
    const titles = await Promise.allSettled(
      [...works.values()].slice(0, 4).map(async (work) => {
        const videos = await this.people.getHubTitleVideos(
          work.mediaType,
          work.id,
        );
        return videos
          .filter(
            (video) =>
              video.site === 'YouTube' && /^[\w-]{11}$/.test(video.key),
          )
          .sort(
            (a, b) =>
              Date.parse(b.published_at || '') -
              Date.parse(a.published_at || ''),
          )
          .slice(0, 12)
          .map(
            (video): CelebrityVideo => ({
              id: video.key,
              title: video.name || work.title,
              thumbnail: `https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`,
              channel: 'YouTube · via TMDB',
              publishedAt: video.published_at || null,
              duration: null,
              category: videoCategory(`${video.type} ${video.name}`),
              source: 'tmdb',
              url: `https://www.youtube.com/watch?v=${video.key}`,
              official: Boolean(video.official),
              canEmbed: false,
              context: work.title,
              content: work,
            }),
          );
      }),
    );
    if (titles.some((result) => result.status === 'fulfilled'))
      sources.tmdb = 'ready';
    let tmdb = titles.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    );
    const youtube: CelebrityVideo[] = [];
    if (this.youtube.enabled) {
      const results = await Promise.allSettled([
        this.youtube.verify(tmdb),
        // At most two search calls per hourly snapshot; exact-ID checks cost no search quota.
        ...featured.slice(0, 2).map(({ person, work }) =>
          this.youtube
            .discover(
              {
                id: person.id,
                name: person.name,
                aliases: [person.name],
                contexts: [work.title],
                works: [work],
                department: person.known_for_department,
                officialChannelIds: [],
              },
              true,
            )
            .then((result) =>
              result.videos.filter((video) =>
                [
                  'interview',
                  'trailer',
                  'clip',
                  'behind-scenes',
                  'appearance',
                  'event',
                ].includes(video.category),
              ),
            ),
        ),
      ]);
      if (
        results.some(
          (result, index) =>
            result.status === 'fulfilled' && (index > 0 || tmdb.length > 0),
        )
      )
        sources.youtube = 'ready';
      if (results[0].status === 'fulfilled') tmdb = results[0].value;
      // Discovery alone is not evidence that a fan upload is an authentic title video.
      const titleChannels = new Set(
        tmdb
          .filter((video) => video.official && video.channelId)
          .map((video) => video.channelId),
      );
      for (const result of results.slice(1))
        if (result.status === 'fulfilled')
          youtube.push(
            ...result.value.filter(
              (video) => video.content && titleChannels.has(video.channelId),
            ),
          );
    }
    if (sources.tmdb === 'unavailable' && sources.youtube !== 'ready')
      throw new Error('Video providers unavailable');
    return {
      videos: selectHubVideos([...youtube, ...tmdb]),
      sources,
      updatedAt: new Date().toISOString(),
    };
  }
}
