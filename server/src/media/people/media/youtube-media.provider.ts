import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { MediaHttpService, MediaProviderError } from './media-http.service';
import {
  identityRelevance,
  safeUrl,
  videoCategory,
  mentions,
} from './celebrity-media.types';
import type {
  CelebrityIdentity,
  CelebrityMediaProvider,
  CelebrityVideo,
  ProviderMedia,
} from './celebrity-media.types';

type YoutubeItem = {
  id: string;
  snippet: {
    title: string;
    description?: string;
    channelTitle: string;
    channelId: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  contentDetails?: {
    duration?: string;
    regionRestriction?: { allowed?: string[]; blocked?: string[] };
  };
  status?: {
    privacyStatus?: string;
    embeddable?: boolean;
    uploadStatus?: string;
    madeForKids?: boolean;
  };
};
@Injectable()
export class YoutubeMediaProvider implements CelebrityMediaProvider {
  private cooldown = 0;
  private cooldownVersion = '';
  private daily = { day: '', count: 0 };
  private readonly logger = new Logger(YoutubeMediaProvider.name);
  constructor(
    private readonly config: ConfigService,
    private readonly http: MediaHttpService,
    private readonly redis: RedisService,
  ) {}
  get enabled() {
    return Boolean(this.config.get<string>('YOUTUBE_API_KEY'));
  }
  get cacheVersion() {
    return createHash('sha256')
      .update(
        JSON.stringify([
          this.config.get<string>('YOUTUBE_API_KEY') || '',
          this.config.get<string>('YOUTUBE_REGION_CODE') || '',
        ]),
      )
      .digest('hex')
      .slice(0, 16);
  }
  private async searchBudget() {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.daily.day) this.daily = { day, count: 0 };
    this.daily.count++;
    const configured = Number(
      this.config.get<number>('YOUTUBE_DAILY_SEARCH_LIMIT') || 60,
    );
    const limit = Number.isFinite(configured)
      ? Math.max(1, Math.min(100, configured))
      : 60;
    let count = this.daily.count;
    try {
      count = Math.max(
        count,
        (
          await this.redis.rateLimitHit(
            `celebrity:youtube:budget:${day}`,
            86400000,
          )
        ).count,
      );
    } catch {
      /* bounded local fallback */
    }
    if (count > limit)
      throw new Error('YouTube daily discovery budget reached');
  }
  private async request<T>(method: string, params: Record<string, string>) {
    const cooldownKey = `celebrity:youtube:cooldown:${this.cacheVersion}`;
    if (this.cooldownVersion !== this.cacheVersion) {
      this.cooldown = 0;
      this.cooldownVersion = this.cacheVersion;
    }
    if (this.cooldown > Date.now()) throw new Error('YouTube quota cooldown');
    try {
      if (await this.redis.get(cooldownKey))
        throw new Error('YouTube quota cooldown');
    } catch (error) {
      if (error instanceof Error && error.message === 'YouTube quota cooldown')
        throw error;
    }
    const url = new URL(`https://www.googleapis.com/youtube/v3/${method}`);
    url.search = new URLSearchParams({
      ...params,
      key: this.config.get<string>('YOUTUBE_API_KEY') || '',
    }).toString();
    try {
      return await this.http.json<T>(url);
    } catch (error) {
      if (
        error instanceof MediaProviderError &&
        (error.status === 429 ||
          ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(
            error.reason || '',
          ))
      ) {
        this.cooldown = Date.now() + 3600000;
        try {
          await this.redis.set(cooldownKey, '1', 3600);
        } catch {
          /* local cooldown */
        }
      }
      this.logger.warn({
        event: 'celebrity_youtube_request_failed',
        operation: method,
        status: error instanceof MediaProviderError ? error.status : undefined,
        reason:
          error instanceof MediaProviderError
            ? error.reason || 'httpError'
            : 'networkError',
      });
      throw error;
    }
  }
  async discover(
    identity: CelebrityIdentity,
    latest = false,
  ): Promise<ProviderMedia> {
    if (!this.enabled) return { photos: [], videos: [] };
    // No unaided single-name searches. A known group/work disambiguates stage names.
    if (
      !identity.contexts.length &&
      !identity.officialChannelIds.length &&
      !identity.name.trim().includes(' ')
    )
      return { photos: [], videos: [] };
    const context = identity.contexts[0] || '';
    const query = `${identity.name} ${context}`.slice(0, 140);
    await this.searchBudget();
    const search = await this.request<{
      items?: Array<{ id?: { videoId?: string } }>;
    }>('search', {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: '40',
      order: latest ? 'date' : 'relevance',
      ...(latest
        ? { publishedAfter: new Date(Date.now() - 90 * 86400000).toISOString() }
        : {}),
      safeSearch: 'strict',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      ...(this.config.get<string>('YOUTUBE_REGION_CODE')
        ? { regionCode: this.config.get<string>('YOUTUBE_REGION_CODE')! }
        : {}),
    });
    if (!Array.isArray(search.items))
      throw new Error('Invalid YouTube search response');
    const ids = [
      ...new Set(
        search.items
          .map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id && /^[\w-]{11}$/.test(id))),
      ),
    ];
    if (!ids.length) return { photos: [], videos: [] };
    const details = await this.request<{ items?: YoutubeItem[] }>('videos', {
      part: 'snippet,contentDetails,status',
      id: ids.join(','),
    });
    if (!Array.isArray(details.items))
      throw new Error('Invalid YouTube video response');
    const region = this.config.get<string>('YOUTUBE_REGION_CODE');
    const videos: CelebrityVideo[] = [];
    for (const item of details.items) {
      if (
        !item.snippet?.title ||
        !/^[\w-]{11}$/.test(item.id) ||
        item.status?.privacyStatus !== 'public' ||
        item.status?.embeddable !== true ||
        item.status?.uploadStatus !== 'processed'
      )
        continue;
      const restrictions = item.contentDetails?.regionRestriction;
      if (
        region &&
        (restrictions?.blocked?.includes(region) ||
          (restrictions?.allowed && !restrictions.allowed.includes(region)))
      )
        continue;
      if (
        /\breaction\b|\bcover\b|\btribute\b|\bAI generated\b|\bconcept\b|\bfan.?made\b|\bfan trailer\b|\bedit(?:s)?\b|\breview\b/i.test(
          item.snippet.title,
        )
      )
        continue;
      const official = identity.officialChannelIds.includes(
        item.snippet.channelId,
      );
      const category = videoCategory(item.snippet.title);
      if (category === 'other' && !official) continue;
      const relevance = identityRelevance(
        identity,
        item.snippet.title,
        item.snippet.description,
        official,
      );
      if (!relevance) continue;
      const thumb =
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url;
      const thumbnail = safeUrl(thumb, ['i.ytimg.com', 'img.youtube.com']);
      if (!thumbnail) continue;
      // "Official" in a title or channel name is not evidence of ownership.
      videos.push({
        id: item.id,
        title: item.snippet.title,
        thumbnail,
        channel: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt || null,
        duration: item.contentDetails?.duration || null,
        category,
        source: 'youtube',
        url: `https://www.youtube.com/watch?v=${item.id}`,
        official,
        // Unconfirmed/child-directed content is linked out instead of embedded.
        canEmbed: item.status.madeForKids === false,
        regionRestrictions: restrictions,
        content: identity.works
          ?.filter((work) => mentions(item.snippet.title, work.title))
          .sort((a, b) => b.title.length - a.title.length)[0],
        person: { id: identity.id, name: identity.name },
      });
    }
    return { photos: [], videos };
  }

  // Checking exact TMDB-linked video IDs uses videos.list, without a search call.
  async verify(videos: CelebrityVideo[]): Promise<CelebrityVideo[]> {
    if (!this.enabled || !videos.length) return videos;
    const ids = [
      ...new Set(
        videos.map((video) => video.id).filter((id) => /^[\w-]{11}$/.test(id)),
      ),
    ].slice(0, 50);
    const details = await this.request<{ items?: YoutubeItem[] }>('videos', {
      part: 'snippet,contentDetails,status',
      id: ids.join(','),
    });
    if (!Array.isArray(details.items))
      throw new Error('Invalid YouTube video response');
    const items = new Map(details.items.map((item) => [item.id, item]));
    const region = this.config.get<string>('YOUTUBE_REGION_CODE');
    return videos.flatMap((video) => {
      const item = items.get(video.id);
      const status = item?.status;
      const restrictions = item?.contentDetails?.regionRestriction;
      if (
        !item?.snippet?.title ||
        status?.privacyStatus !== 'public' ||
        status.uploadStatus !== 'processed' ||
        status.embeddable !== true ||
        (region &&
          (restrictions?.blocked?.includes(region) ||
            (restrictions?.allowed && !restrictions.allowed.includes(region))))
      )
        return [];
      return [
        {
          ...video,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt || null,
          duration: item.contentDetails?.duration || null,
          canEmbed: status.madeForKids === false,
          thumbnail:
            safeUrl(
              item.snippet.thumbnails?.maxres?.url ||
                item.snippet.thumbnails?.high?.url,
              ['i.ytimg.com', 'img.youtube.com'],
            ) || video.thumbnail,
          regionRestrictions: restrictions,
        },
      ];
    });
  }
}
