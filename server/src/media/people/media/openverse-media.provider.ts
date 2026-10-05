import { Injectable } from '@nestjs/common';
import { MediaHttpService } from './media-http.service';
import {
  CelebrityIdentity,
  CelebrityMediaProvider,
  CelebrityPhoto,
  ProviderMedia,
} from './celebrity-media.types';
import {
  photoLicense,
  photoQueries,
  photoRelevance,
  publicPhotoUrl,
} from './photo-discovery';

type Result = {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  width?: number;
  height?: number;
  mature?: boolean;
  tags?: Array<{ name: string }>;
};
@Injectable()
export class OpenverseMediaProvider implements CelebrityMediaProvider {
  constructor(private readonly http: MediaHttpService) {}
  async discover(identity: CelebrityIdentity): Promise<ProviderMedia> {
    const photos: CelebrityPhoto[] = [];
    let succeeded = false;
    for (const query of photoQueries(identity)) {
      try {
        const url = new URL('https://api.openverse.org/v1/images/');
        url.search = new URLSearchParams({
          q: query,
          page_size: '40',
          mature: 'false',
          filter_dead: 'true',
          license: 'by,by-sa,cc0,pdm',
        }).toString();
        const response = await this.http.json<{ results: Result[] }>(url);
        if (!Array.isArray(response.results))
          throw new Error('Invalid photo response');
        succeeded = true;
        for (const item of response.results) {
          const relevance = photoRelevance(
            identity,
            item.title || '',
            (item.tags || []).map((tag) => tag.name).join(' '),
          );
          const original = publicPhotoUrl(item.url);
          const thumbnail = publicPhotoUrl(item.thumbnail || item.url);
          const sourceUrl = publicPhotoUrl(item.foreign_landing_url);
          const license = photoLicense(
            item.license || '',
            item.license_version,
          );
          if (
            item.mature ||
            !relevance ||
            !original ||
            !thumbnail ||
            !sourceUrl ||
            !license ||
            !Number.isFinite(item.width) ||
            !Number.isFinite(item.height) ||
            Math.min(item.width || 0, item.height || 0) < 400 ||
            (!item.creator && !['cc0', 'pdm'].includes(item.license || ''))
          )
            continue;
          photos.push({
            id: `openverse:${item.id}`,
            title: item.title || `${identity.name} portrait`,
            url: original,
            thumbnail,
            sourceUrl,
            width: item.width!,
            height: item.height!,
            attribution: item.creator || 'Public domain',
            license,
            licenseUrl: publicPhotoUrl(item.license_url) || undefined,
            source: 'openverse',
            relevanceScore: relevance,
          });
        }
      } catch {
        /* Try a second alias; aggregation retains other providers. */
      }
    }
    if (!succeeded) throw new Error('Openverse unavailable');
    return { photos, videos: [] };
  }
}
