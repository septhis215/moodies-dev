import {
  parseNewsFeed,
  matchesIdentity,
  mergeNews,
  NEWS_PUBLISHERS,
} from './celebrity-news';
import type { CelebrityIdentity } from '../media/celebrity-media.types';

const now = Date.parse('2026-11-01T08:00:00Z');
const publisher = NEWS_PUBLISHERS[0];
const identity: CelebrityIdentity = {
  id: 31,
  name: 'Tom Hanks',
  aliases: ['Tom Hanks'],
  contexts: ['Toy Story'],
  department: 'Acting',
  officialChannelIds: [],
};
const item = (
  title = 'Tom Hanks returns to Saturday Night Live',
  date = 'Sun, 01 Nov 2026 03:52:00 GMT',
  link = 'https://variety.com/2026/tv/news/tom-hanks-123/',
) =>
  `<item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${date}</pubDate><description><![CDATA[<p>Toy Story actor</p>]]></description></item>`;
const feed = (items: string) =>
  `<rss version="2.0"><channel><title>Variety</title>${items}</channel></rss>`;

describe('celebrity news ingestion', () => {
  it('keeps the actual publisher story image and rejects untrusted image hosts', () => {
    const story = item().replace(
      '</item>',
      '<media:thumbnail url="https://variety.com/wp-content/uploads/2026/11/story.jpg?resize=800&amp;quality=80" /></item>',
    );
    expect(parseNewsFeed(feed(story), publisher, now)[0].imageUrl).toBe(
      'https://variety.com/wp-content/uploads/2026/11/story.jpg?resize=800&quality=80',
    );
    for (const host of [
      'http://variety.com',
      'https://variety.com.evil.test',
      'https://user@variety.com',
      'https://127.0.0.1',
    ]) {
      expect(
        parseNewsFeed(
          feed(
            story.replace(
              'https://variety.com/wp-content',
              `${host}/wp-content`,
            ),
          ),
          publisher,
          now,
        )[0].imageUrl,
      ).toBeNull();
    }
  });
  it('preserves publisher attribution and publication time, decodes entities and strips markup', () => {
    const [article] = parseNewsFeed(
      feed(item('Tom Hanks &#038; friends <b>return</b>')),
      publisher,
      now,
    );
    expect(article).toMatchObject({
      title: 'Tom Hanks & friends return',
      publisher: 'Variety',
      source: 'variety',
      publishedAt: '2026-11-01T03:52:00.000Z',
      url: 'https://variety.com/2026/tv/news/tom-hanks-123/',
    });
    expect(article).not.toHaveProperty('summary');
  });

  it('rejects old, undated, invalid and future-dated stories', () => {
    for (const date of ['2024-01-01', '', 'bad', '2026-11-02T00:00:00Z']) {
      expect(
        parseNewsFeed(feed(item(undefined, date)), publisher, now),
      ).toEqual([]);
    }
  });

  it('rejects external hosts, credentials, HTTP, malicious links and non-article URLs', () => {
    for (const url of [
      'https://variety.com.evil.test/123',
      'https://x@variety.com/2026/story',
      'http://variety.com/2026/story',
      'javascript:alert(1)',
      'https://variety.com/feed/',
      'https://variety.com/',
    ]) {
      expect(
        parseNewsFeed(feed(item(undefined, undefined, url)), publisher, now),
      ).toEqual([]);
    }
  });

  it('rejects malformed XML, HTML, DOCTYPE, entities and oversized input', () => {
    for (const xml of [
      '<rss><channel></rss>',
      '<html><body>blocked</body></html>',
      '<!DOCTYPE rss><rss/>',
      '<!ENTITY a "x"><rss/>',
      'x'.repeat(512 * 1024 + 1),
    ]) {
      expect(() => parseNewsFeed(xml, publisher, now)).toThrow();
    }
  });

  it('matches whole names and requires context for short stage names', () => {
    const [article] = parseNewsFeed(feed(item()), publisher, now);
    expect(matchesIdentity(article, identity)).toBe(true);
    expect(
      matchesIdentity({ ...article, title: 'Tom Hollander returns' }, identity),
    ).toBe(false);
    const woni = {
      ...identity,
      name: 'Woni',
      aliases: ['Woni'],
      contexts: ['RESCENE'],
    };
    expect(matchesIdentity({ ...article, title: 'Woni interview' }, woni)).toBe(
      false,
    );
    expect(
      matchesIdentity(
        { ...article, title: 'Woni of RESCENE shares an interview' },
        woni,
      ),
    ).toBe(true);
    expect(
      matchesIdentity({ ...article, title: 'Toy Story returns' }, identity),
    ).toBe(false);
  });

  it('deduplicates canonical URLs and equal headlines, then sorts by published date', () => {
    const [article] = parseNewsFeed(feed(item()), publisher, now);
    const newer = {
      ...article,
      id: 'new',
      title: 'Another story',
      url: 'https://variety.com/2026/another/',
      publishedAt: '2026-11-01T07:00:00Z',
    };
    expect(
      mergeNews(
        [article, { ...article, url: `${article.url}?utm_source=rss` }, newer],
        now,
      ),
    ).toEqual([newer, article]);
    expect(mergeNews([article], now + 31 * 86400000)).toEqual([]);
  });
});
