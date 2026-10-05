import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { CelebrityIdentityService } from './celebrity-identity.service';
import { MediaCacheService } from './media-cache.service';
import { TmdbMediaProvider } from './tmdb-media.provider';
import { YoutubeMediaProvider } from './youtube-media.provider';
import { WikimediaMediaProvider } from './wikimedia-media.provider';
import { OpenverseMediaProvider } from './openverse-media.provider';
import { dedupePhotos, dedupeVideos } from './celebrity-media.types';
import type {
  CelebrityMedia,
  CelebrityMediaProvider,
  MediaSource,
  ProviderMedia,
} from './celebrity-media.types';

@Injectable()
export class CelebrityMediaService {
  constructor(
    private readonly identity: CelebrityIdentityService,
    private readonly cache: MediaCacheService,
    private readonly tmdb: TmdbMediaProvider,
    private readonly youtube: YoutubeMediaProvider,
    private readonly wikimedia: WikimediaMediaProvider,
    private readonly config: ConfigService,
    private readonly openverse: OpenverseMediaProvider,
  ) {}
  async getMedia(id: number): Promise<CelebrityMedia> {
    // Operator identity hints / region changes must not reuse a differently filtered feed.
    const version = createHash('sha256')
      .update(
        JSON.stringify([
          this.youtube.enabled,
          this.config.get('YOUTUBE_REGION_CODE'),
          this.config.get('CELEBRITY_MEDIA_IDENTITIES'),
        ]),
      )
      .digest('hex')
      .slice(0, 12);
    const key = `celebrity:${id}:media:v3:${version}`;
    const cached = await this.cache.get<CelebrityMedia>(
      key,
      (response) =>
        Object.values(response.sources).some(
          (status) => status === 'unavailable' || status === 'stale',
        )
          ? 15 * 60
          : 12 * 3600,
      async () => {
        const identity = await this.identity.resolve(id);
        const providers: Array<[MediaSource, CelebrityMediaProvider, number]> =
          [
            ['tmdb', this.tmdb, 6 * 3600],
            ['youtube', this.youtube, 12 * 3600],
            ['wikimedia', this.wikimedia, 24 * 3600],
            ['openverse', this.openverse, 12 * 3600],
          ];
        const sources: CelebrityMedia['sources'] = {
          tmdb: 'unavailable',
          youtube: this.youtube.enabled ? 'unavailable' : 'disabled',
          wikimedia: 'unavailable',
          openverse: 'unavailable',
        };
        const results = await Promise.all(
          providers.map(async ([source, provider, ttl]) => {
            if (source === 'youtube' && !this.youtube.enabled)
              return { photos: [], videos: [] };
            try {
              const result = await this.cache.get<ProviderMedia>(
                `celebrity:${id}:${source}:v2:${version}`,
                ttl,
                () => provider.discover(identity),
              );
              sources[source] = result.stale ? 'stale' : 'ready';
              return result.value;
            } catch {
              return { photos: [], videos: [] };
            }
          }),
        );
        const photos = dedupePhotos(results.flatMap((result) => result.photos));
        const videos = dedupeVideos(results.flatMap((result) => result.videos));
        const response: CelebrityMedia = {
          photos,
          videos,
          sources,
          totalPhotos: photos.length,
          totalVideos: videos.length,
          updatedAt: new Date().toISOString(),
        };
        return response;
      },
    );
    if (!cached.stale) return cached.value;
    return {
      ...cached.value,
      sources: Object.fromEntries(
        Object.entries(cached.value.sources).map(([source, status]) => [
          source,
          status === 'ready' ? 'stale' : status,
        ]),
      ) as CelebrityMedia['sources'],
    };
  }
}
