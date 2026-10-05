import { Injectable } from '@nestjs/common';
import { PeopleService } from '../people.service';
import { videoCategory } from './celebrity-media.types';
import type {
  CelebrityIdentity,
  CelebrityMediaProvider,
  ProviderMedia,
} from './celebrity-media.types';

@Injectable()
export class TmdbMediaProvider implements CelebrityMediaProvider {
  constructor(private readonly people: PeopleService) {}
  async discover(identity: CelebrityIdentity): Promise<ProviderMedia> {
    const [images, videos] = await Promise.allSettled([
      this.people.getImages(identity.id),
      this.people.getRelatedVideos(identity.id),
    ]);
    if (images.status === 'rejected' && videos.status === 'rejected')
      throw new Error('TMDB media unavailable');
    const profiles =
      images.status === 'fulfilled' ? images.value?.profiles || [] : [];
    return {
      photos: profiles
        .filter((image: any) => /^\/[\w.-]+$/.test(image.file_path || ''))
        .slice(0, 60)
        .map((image: any) => ({
          id: `tmdb:${image.file_path}`,
          url: `https://image.tmdb.org/t/p/original${image.file_path}`,
          thumbnail: `https://image.tmdb.org/t/p/w500${image.file_path}`,
          title: `${identity.name} portrait`,
          width: Number(image.width || 500),
          height: Number(image.height || 750),
          source: 'tmdb',
          sourceUrl: `https://www.themoviedb.org/person/${identity.id}/images/profiles`,
          attribution: 'TMDB',
          license: 'TMDB image',
          relevanceScore:
            0.95 + Math.min(Number(image.vote_average || 0) / 200, 0.04),
        })),
      videos: (videos.status === 'fulfilled' ? videos.value : [])
        .filter((video: any) => /^[\w-]{11}$/.test(video.video_key || ''))
        .map((video: any) => ({
          id: video.video_key,
          title: String(video.video_title || 'On-screen moment'),
          thumbnail: `https://img.youtube.com/vi/${video.video_key}/hqdefault.jpg`,
          channel: 'YouTube · via TMDB',
          publishedAt: video.published_at || null,
          duration: null,
          category: videoCategory(`${video.video_type} ${video.video_title}`),
          source: 'tmdb',
          url: `https://www.youtube.com/watch?v=${video.video_key}`,
          official: Boolean(video.official),
          context: video.media_title,
          canEmbed: false,
          relevanceScore: Math.min(
            0.94,
            0.55 +
              Number(video.celebrity_relevance_score || 0) / 500 +
              (video.official ? 0.06 : 0),
          ),
        })),
    };
  }
}
