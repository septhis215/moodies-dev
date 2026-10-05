export type MediaSource = 'tmdb' | 'youtube' | 'wikimedia' | 'openverse';
export type VideoCategory =
  | 'trailer'
  | 'clip'
  | 'interview'
  | 'performance'
  | 'music-video'
  | 'behind-scenes'
  | 'appearance'
  | 'event'
  | 'fancam'
  | 'live'
  | 'other';
export interface CelebrityIdentity {
  id: number;
  name: string;
  aliases: string[];
  contexts: string[];
  department: string;
  wikidataId?: string;
  commonsCategory?: string;
  officialChannelIds: string[];
}
export interface CelebrityPhoto {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  width: number;
  height: number;
  source: MediaSource;
  sourceUrl: string;
  attribution: string;
  license: string;
  licenseUrl?: string;
  contentHash?: string;
  relevanceScore: number;
}
export interface CelebrityVideo {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId?: string;
  publishedAt: string | null;
  duration: string | null;
  category: VideoCategory;
  source: MediaSource;
  url: string;
  official: boolean;
  relevanceScore?: number;
  canEmbed: boolean;
  regionRestrictions?: { allowed?: string[]; blocked?: string[] };
  context?: string;
}
export interface ProviderMedia {
  photos: CelebrityPhoto[];
  videos: CelebrityVideo[];
}
export interface CelebrityMediaProvider {
  discover(identity: CelebrityIdentity): Promise<ProviderMedia>;
}
export interface CelebrityMedia extends ProviderMedia {
  sources: Record<MediaSource, 'ready' | 'stale' | 'unavailable' | 'disabled'>;
  totalPhotos: number;
  totalVideos: number;
  updatedAt: string;
}

export function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function mentions(text: string, name: string) {
  const needle = normalize(name);
  return needle.length >= 2 && ` ${normalize(text)} `.includes(` ${needle} `);
}
// A single short/stage name requires corroboration from a verified group or work.
export function identityRelevance(
  identity: CelebrityIdentity,
  title: string,
  description = '',
  confirmedChannel = false,
) {
  const name = identity.aliases.find(
    (alias) =>
      !identity.contexts.some(
        (context) => normalize(context) === normalize(alias),
      ) && mentions(title, alias),
  );
  if (!name) return 0;
  const context = identity.contexts.some((value) =>
    mentions(`${title} ${description}`, value),
  );
  if (!context && !confirmedChannel) return 0;
  return context ? 0.96 : 0.9;
}
export function videoCategory(title: string): VideoCategory {
  if (/fancam|직캠/i.test(title)) return 'fancam';
  if (/behind|making.of|비하인드/i.test(title)) return 'behind-scenes';
  if (/interview|인터뷰/i.test(title)) return 'interview';
  if (/music video|\bm\s*\/\s*v\b|\bmv\b/i.test(title)) return 'music-video';
  if (/trailer|teaser|preview/i.test(title)) return 'trailer';
  if (/radio|\blive\b|라이브/i.test(title)) return 'live';
  if (/festival|red carpet|premiere|event/i.test(title)) return 'event';
  if (/performance|stage|무대/i.test(title)) return 'performance';
  if (/talk show|appearance|variety/i.test(title)) return 'appearance';
  if (/clip|scene|featurette/i.test(title)) return 'clip';
  return 'other';
}
export function safeUrl(value: string | undefined, hosts: string[]) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' &&
      hosts.includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
export function dedupePhotos(photos: CelebrityPhoto[]) {
  const seen = new Set<string>();
  return [...photos]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .filter((photo) => {
      // Commons SHA1 catches alternate filenames of the same file. TMDB size URLs
      // and Commons thumbnail URLs collapse to the original file identifier.
      const canonical = photo.url
        .replace(/\/t\/p\/[^/]+\//, '/t/p/')
        .replace(/\/thumb\//, '/')
        .replace(/\/\d+px-[^/]+$/, '')
        .split('?')[0];
      const keys = [
        canonical,
        ...(photo.url.includes('staticflickr.com/') &&
        photo.url.match(/\/(\d+)_/)
          ? [`flickr:${photo.url.match(/\/(\d+)_/)![1]}`]
          : []),
        ...(photo.contentHash ? [`hash:${photo.contentHash}`] : []),
      ];
      if (keys.some((key) => seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
      return true;
    })
    .slice(0, 60);
}
export function dedupeVideos(videos: CelebrityVideo[]) {
  const ids = new Set<string>();
  const titles = new Set<string>();
  const youtubeDetails = new Map(
    videos
      .filter((video) => video.source === 'youtube')
      .map((video) => [video.id, video]),
  );
  // YouTube's search order is preserved within editorial source tiers. Do not
  // create composite YouTube popularity scores from views/likes/API statistics.
  const rank = (video: CelebrityVideo) =>
    Number(video.official) * 2 +
    (video.source === 'tmdb' ? video.relevanceScore || 0 : 1);
  return [...videos]
    .sort((a, b) => rank(b) - rank(a))
    .filter((video) => {
      const title = `${video.channelId || video.channel}:${normalize(video.title)}`;
      if (
        !/^[\w-]{11}$/.test(video.id) ||
        ids.has(video.id) ||
        titles.has(title)
      )
        return false;
      ids.add(video.id);
      titles.add(title);
      return true;
    })
    .slice(0, 48)
    .map((video) => {
      const verified = youtubeDetails.get(video.id);
      if (!verified || video.source === 'youtube') return video;
      // Keep the title's TMDB context, but use current YouTube playback metadata
      // when both providers identify the exact same video.
      return {
        ...video,
        canEmbed: verified.canEmbed,
        duration: verified.duration,
        channel: verified.channel,
        channelId: verified.channelId,
        regionRestrictions: verified.regionRestrictions,
        publishedAt: verified.publishedAt,
      };
    });
}
