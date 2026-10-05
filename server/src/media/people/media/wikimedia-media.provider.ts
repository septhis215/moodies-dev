import { Injectable } from '@nestjs/common';
import { MediaHttpService } from './media-http.service';
import { identityRelevance, mentions, safeUrl } from './celebrity-media.types';
import type {
  CelebrityIdentity,
  CelebrityMediaProvider,
  CelebrityPhoto,
  ProviderMedia,
} from './celebrity-media.types';

type ImageInfo = {
  url: string;
  thumburl?: string;
  descriptionurl: string;
  width: number;
  height: number;
  sha1?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
};
const text = (value: string = '') =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
@Injectable()
export class WikimediaMediaProvider implements CelebrityMediaProvider {
  constructor(private readonly http: MediaHttpService) {}
  async discover(identity: CelebrityIdentity): Promise<ProviderMedia> {
    // An exact TMDB/IMDb -> Wikidata link is required, never a guessed name match.
    if (!identity.wikidataId) return { photos: [], videos: [] };
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    const generator: Record<string, string> = identity.commonsCategory
      ? {
          generator: 'categorymembers',
          gcmtitle: `Category:${identity.commonsCategory}`,
          gcmtype: 'file',
          gcmlimit: '40',
        }
      : {
          generator: 'search',
          gsrsearch: `"${identity.name.replace(/["\\]/g, '')}" ${identity.contexts[0] || ''}`,
          gsrnamespace: '6',
          gsrlimit: '40',
        };
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      ...generator,
      prop: 'imageinfo',
      iiprop: 'url|size|mime|sha1|extmetadata',
      iiurlwidth: '640',
      maxlag: '5',
    }).toString();
    const data = await this.http.json<{
      query?: {
        pages?: Array<{
          pageid: number;
          title: string;
          imageinfo?: ImageInfo[];
        }>;
      };
      error?: unknown;
    }>(url);
    if (data.error) throw new Error('Wikimedia unavailable');
    const pages = data.query?.pages || [];
    if (!Array.isArray(pages)) throw new Error('Invalid Wikimedia response');
    const photos: CelebrityPhoto[] = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (
        !info ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime || '') ||
        Math.min(info.width, info.height) < 500
      )
        continue;
      const metadata = info.extmetadata || {};
      const title = text(
        page.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
      );
      const description = text(metadata.ImageDescription?.value);
      // Keep individual photographs, not logos, posters, albums or unidentified groups.
      if (
        /\blogo\b|\balbum\b|\bposter\b|\bcover art\b|\bgroup photo\b|\bwith\b|\band\b|\bet al\b|\bcollage\b/i.test(
          `${title} ${description}`,
        )
      )
        continue;
      const relevance = identityRelevance(
        identity,
        title,
        description,
        Boolean(identity.commonsCategory),
      );
      const inPersonCategory = Boolean(
        identity.commonsCategory &&
        identity.aliases.some((alias) => mentions(title, alias)),
      );
      if (!relevance && !inPersonCategory) continue;
      const license = text(metadata.LicenseShortName?.value);
      if (
        !/^(CC BY(?:-SA)? [\d.]+|CC0(?: [\d.]+)?|Public domain)$/i.test(
          license,
        ) ||
        metadata.Restrictions?.value
      )
        continue;
      const original = safeUrl(info.url, ['upload.wikimedia.org']);
      const thumbnail = safeUrl(info.thumburl || info.url, [
        'upload.wikimedia.org',
      ]);
      const sourceUrl = safeUrl(info.descriptionurl, ['commons.wikimedia.org']);
      if (!original || !thumbnail || !sourceUrl) continue;
      const attribution = text(
        metadata.Artist?.value || metadata.Credit?.value,
      );
      if (!attribution && !/CC0|Public domain/i.test(license)) continue;
      photos.push({
        id: `wikimedia:${page.pageid}`,
        url: original,
        thumbnail,
        title,
        width: info.width,
        height: info.height,
        source: 'wikimedia',
        sourceUrl,
        attribution: attribution || 'Wikimedia Commons',
        license,
        licenseUrl:
          safeUrl(metadata.LicenseUrl?.value, ['creativecommons.org']) ||
          undefined,
        contentHash: info.sha1,
        relevanceScore:
          (relevance || 0.85) * 0.9 +
          Math.min(Math.min(info.width, info.height) / 30000, 0.09),
      });
    }
    return { photos, videos: [] };
  }
}
