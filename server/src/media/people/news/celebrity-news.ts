import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { mentions, normalize } from '../media/celebrity-media.types';
import type { CelebrityIdentity } from '../media/celebrity-media.types';

export const NEWS_MAX_BYTES = 512 * 1024;
export const NEWS_MAX_AGE_MS = 30 * 86400000;
export const NEWS_PUBLISHERS = [
  {
    id: 'variety',
    name: 'Variety',
    origin: 'https://variety.com',
    topicPath: '/t/',
  },
  {
    id: 'deadline',
    name: 'Deadline',
    origin: 'https://deadline.com',
    topicPath: '/tag/',
  },
  {
    id: 'thr',
    name: 'The Hollywood Reporter',
    origin: 'https://www.hollywoodreporter.com',
    topicPath: '/t/',
  },
] as const;
export type NewsPublisher = (typeof NEWS_PUBLISHERS)[number];
export type NewsTopic = 'news' | 'happenings' | 'projects';
export interface CelebrityArticle {
  id: string;
  title: string;
  url: string;
  source: NewsPublisher['id'];
  publisher: string;
  publishedAt: string;
  topic: NewsTopic;
  imageUrl?: string | null;
}
export interface CelebrityNews {
  articles: CelebrityArticle[];
  sources: Array<{
    id: NewsPublisher['id'];
    name: string;
    url: string;
    status: 'ready' | 'stale' | 'unavailable';
    fetchedAt: string | null;
  }>;
  person: { id: number; name: string } | null;
  windowDays: number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  ignorePiTags: true,
  isArray: (tag) => tag === 'item',
});
function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    ndash: '–',
    mdash: '—',
  };
  return value
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (!code.startsWith('#')) return entities[code] || entity;
      const number =
        code[1].toLowerCase() === 'x'
          ? parseInt(code.slice(2), 16)
          : Number(code.slice(1));
      return number > 0 &&
        number <= 0x10ffff &&
        !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : '';
    })
    .replace(/<[^>]*>/g, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function newsImage(
  value: unknown,
  publisher: NewsPublisher,
): string | null {
  try {
    if (typeof value !== 'string') return null;
    const url = new URL(text(value));
    const hosts = [
      new URL(publisher.origin).hostname,
      'www.hollywoodreporter.com',
      'www.variety.com',
      'www.deadline.com',
      'hollywoodreporter.com',
    ];
    if (
      url.protocol !== 'https:' ||
      !hosts.includes(url.hostname) ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      !/\.(?:jpe?g|png|webp|avif)(?:$|\/)/i.test(url.pathname)
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

function feedImage(item: Record<string, unknown>, publisher: NewsPublisher) {
  for (const tag of ['media:content', 'media:thumbnail', 'enclosure']) {
    const values = Array.isArray(item[tag]) ? item[tag] : [item[tag]];
    for (const value of values as Array<Record<string, unknown> | undefined>) {
      const url = newsImage(value?.['@_url'], publisher);
      if (url) return url;
    }
  }
  const html = typeof item.description === 'string' ? item.description : '';
  return newsImage(
    html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1],
    publisher,
  );
}
function canonicalUrl(value: unknown, publisher: NewsPublisher): string | null {
  try {
    if (typeof value !== 'string') return null;
    const url = new URL(text(value));
    if (
      url.origin !== publisher.origin ||
      url.username ||
      url.password ||
      !/^\/\d{4}\/.+/.test(url.pathname)
    )
      return null;
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/amp\/?$/, '/');
    return url.toString();
  } catch {
    return null;
  }
}
export function newsTopic(title: string): NewsTopic {
  if (
    /\b(festival|awards?|oscars?|emmys?|red carpet|premiere|gala|ceremony|halloween|comic.con)\b/i.test(
      title,
    )
  )
    return 'happenings';
  if (
    /\b(cast|casting|joins|trailer|teaser|release|stars? in|set for|directs?|directing|season|sequel)\b/i.test(
      title,
    )
  )
    return 'projects';
  return 'news';
}
export function isRecent(article: CelebrityArticle, now = Date.now()) {
  const time = Date.parse(article.publishedAt);
  return (
    Number.isFinite(time) &&
    time >= now - NEWS_MAX_AGE_MS &&
    time <= now + 5 * 60000
  );
}
export function parseNewsFeed(
  xml: string,
  publisher: NewsPublisher,
  now = Date.now(),
): CelebrityArticle[] {
  if (
    Buffer.byteLength(xml, 'utf8') > NEWS_MAX_BYTES ||
    /<!\s*(DOCTYPE|ENTITY)/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new Error('Invalid publisher feed');
  const data = parser.parse(xml) as {
    rss?: { channel?: { item?: Record<string, unknown>[] } };
  };
  if (!data.rss?.channel) throw new Error('Not an RSS feed');
  const articles: CelebrityArticle[] = [];
  for (const item of (data.rss.channel.item || []).slice(0, 80)) {
    const title = text(item.title).slice(0, 500);
    const url = canonicalUrl(item.link, publisher);
    const date = Date.parse(text(item.pubDate));
    if (!title || !url || !Number.isFinite(date)) continue;
    const article: CelebrityArticle = {
      id: createHash('sha256').update(url).digest('hex').slice(0, 20),
      title,
      url,
      source: publisher.id,
      publisher: publisher.name,
      publishedAt: new Date(date).toISOString(),
      topic: newsTopic(title),
      imageUrl: feedImage(item, publisher),
    };
    if (isRecent(article, now)) articles.push(article);
  }
  return articles;
}
export function matchesIdentity(
  article: CelebrityArticle,
  identity: CelebrityIdentity,
  requireContext = false,
) {
  return identity.aliases.some((alias) => {
    if (
      !mentions(article.title, alias) ||
      identity.contexts.some(
        (context) => normalize(context) === normalize(alias),
      )
    )
      return false;
    // Short/stage names need corroboration in the headline, even on a topic feed.
    return (
      (!requireContext && normalize(alias).split(' ').length >= 2) ||
      identity.contexts.some((context) => mentions(article.title, context))
    );
  });
}
export function mergeNews(articles: CelebrityArticle[], now = Date.now()) {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return [...articles]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((article) => {
      const url = article.url.split('?')[0];
      const title = normalize(article.title);
      if (!isRecent(article, now) || urls.has(url) || titles.has(title))
        return false;
      urls.add(url);
      titles.add(title);
      return true;
    })
    .slice(0, 36);
}
