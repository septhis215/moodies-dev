import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bottleneck from 'bottleneck';
import { CelebrityIdentityService } from '../media/celebrity-identity.service';
import { MediaCacheService } from '../media/media-cache.service';
import { PeopleService } from '../people.service';
import { normalize } from '../media/celebrity-media.types';
import {
  NEWS_MAX_BYTES,
  NEWS_PUBLISHERS,
  matchesIdentity,
  mergeNews,
  parseNewsFeed,
  newsImage,
} from './celebrity-news';
import type {
  CelebrityNews,
  CelebrityArticle,
  NewsPublisher,
} from './celebrity-news';

type Snapshot = { articles: CelebrityArticle[]; fetchedAt: string };
@Injectable()
export class CelebrityNewsService {
  private readonly logger = new Logger(CelebrityNewsService.name);
  private readonly limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 100,
    highWater: 12,
    strategy: Bottleneck.strategy.OVERFLOW,
  });
  private readonly imageLimiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 100,
  });
  constructor(
    private readonly identity: CelebrityIdentityService,
    private readonly cache: MediaCacheService,
    private readonly config: ConfigService,
    private readonly people: PeopleService,
  ) {}

  async getNews(id?: number): Promise<CelebrityNews> {
    if (id !== undefined && (!Number.isSafeInteger(id) || id < 1))
      throw new BadRequestException('Invalid person ID');
    const person = id === undefined ? null : await this.identity.resolve(id);
    let requireContext = false;
    if (person && normalize(person.name).includes(' ')) {
      try {
        const ambiguity = await this.cache.get(
          `celebrity:news-name:${person.id}:v1`,
          3600,
          async () => {
            const data = (await this.people.searchPeople(person.name)) as {
              results?: Array<{ id: number; name: string }>;
            };
            if (!Array.isArray(data.results))
              throw new Error('Invalid person search');
            const names = data.results.filter(
              (candidate) =>
                typeof candidate.name === 'string' &&
                normalize(candidate.name) === normalize(person.name),
            );
            return (
              !names.some((candidate) => candidate.id === person.id) ||
              names.some((candidate) => candidate.id !== person.id)
            );
          },
          6 * 3600,
        );
        requireContext = ambiguity.stale || ambiguity.value;
      } catch {
        requireContext = true;
      }
    }
    const slug = person?.name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);
    const results = await Promise.all(
      NEWS_PUBLISHERS.map(async (publisher) => {
        const path = slug
          ? `${publisher.topicPath}${encodeURIComponent(slug)}/feed/`
          : '/feed/';
        const source: CelebrityNews['sources'][number] = {
          id: publisher.id,
          name: publisher.name,
          url: publisher.origin,
          status: 'unavailable',
          fetchedAt: null,
        };
        try {
          const result = await this.cache.get<Snapshot>(
            `celebrity:news:v2:${publisher.id}:${slug || 'all'}`,
            600,
            async () => {
              try {
                return await this.limiter.schedule(() =>
                  this.load(publisher, path),
                );
              } catch (error) {
                this.logger.warn({
                  event: 'celebrity_news_source_failed',
                  source: publisher.id,
                });
                throw error;
              }
            },
            6 * 3600,
          );
          source.status = result.stale ? 'stale' : 'ready';
          source.fetchedAt = result.value.fetchedAt;
          return {
            source,
            articles: result.value.articles.filter(
              (article) =>
                !person || matchesIdentity(article, person, requireContext),
            ),
          };
        } catch {
          return { source, articles: [] };
        }
      }),
    );
    return {
      articles: mergeNews(results.flatMap((result) => result.articles)),
      sources: results.map((result) => result.source),
      person: person ? { id: person.id, name: person.name } : null,
      windowDays: 30,
    };
  }

  private async load(
    publisher: NewsPublisher,
    path: string,
  ): Promise<Snapshot> {
    const response = await fetch(new URL(path, publisher.origin), {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent':
          this.config.get<string>('CELEBRITY_MEDIA_USER_AGENT') ||
          'Moodies/1.0 (support@moodies.tech)',
      },
    });
    if (
      !response.ok ||
      !response.body ||
      !/xml/i.test(response.headers.get('content-type') || '') ||
      Number(response.headers.get('content-length')) > NEWS_MAX_BYTES
    ) {
      await response.body?.cancel();
      throw new Error('Publisher feed unavailable');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > NEWS_MAX_BYTES) throw new Error('Publisher feed too large');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const xml = Buffer.concat(chunks).toString('utf8');
    const articles = parseNewsFeed(xml, publisher);
    // Only canonical publisher article URLs parsed above can reach this request.
    await Promise.all(
      articles
        .filter((article) => !article.imageUrl)
        .slice(0, 6)
        .map(async (article) => {
          try {
            const result = await this.cache.get(
              `celebrity:news:image:${article.id}:v1`,
              86400,
              () =>
                this.imageLimiter.schedule(() =>
                  this.loadImage(article, publisher),
                ),
            );
            article.imageUrl = result.value;
          } catch {
            /* A missing photograph must not discard a valid headline. */
          }
        }),
    );
    return {
      articles,
      fetchedAt: new Date().toISOString(),
    };
  }

  private async loadImage(
    article: CelebrityArticle,
    publisher: NewsPublisher,
  ): Promise<string | null> {
    const response = await fetch(article.url, {
      signal: AbortSignal.timeout(4000),
      redirect: 'error',
      headers: {
        accept: 'text/html',
        'User-Agent': 'Moodies/1.0 (support@moodies.tech)',
      },
    });
    if (
      !response.ok ||
      !response.body ||
      !/text\/html/i.test(response.headers.get('content-type') || '')
    ) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size < NEWS_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        chunks.push(
          value.subarray(
            0,
            Math.max(0, NEWS_MAX_BYTES - size + value.byteLength),
          ),
        );
      }
    } finally {
      await reader.cancel();
    }
    const head = Buffer.concat(chunks).toString('utf8').split('</head>')[0];
    for (const tag of head.match(/<meta\b[^>]+>/gi) || []) {
      if (!/(?:property|name)=["']og:image["']/i.test(tag)) continue;
      return newsImage(
        tag.match(/\bcontent=["']([^"']+)["']/i)?.[1],
        publisher,
      );
    }
    return null;
  }
}
