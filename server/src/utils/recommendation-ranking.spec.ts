import { rankRecommendations, seededValue } from './recommendation-ranking';

describe('relevance-bounded session ranking', () => {
  const items = Array.from({ length: 60 }, (_, id) => ({ key: `movie:${id}`, score: id < 30 ? 0.72 : 0.52, genres: [id % 5], language: id % 3 ? 'en' : 'ko', type: id % 2 ? 'tv' : 'movie' }));
  const rank = (seed: number, pool = items) => rankRecommendations(pool, item => item, seed);

  it('is input-order independent, reproducible and does not mutate candidates', () => {
    const original = [...items];
    expect(rank(42)).toEqual(rank(42, [...items].reverse()));
    expect(items).toEqual(original);
    expect(rank(42)).toHaveLength(60);
    expect(new Set(rank(42).map(item => item.key)).size).toBe(60);
  });

  it('varies ties between sessions without promoting a weaker relevance band', () => {
    expect(rank(42).slice(0, 10)).not.toEqual(rank(93).slice(0, 10));
    expect(rank(42).slice(0, 30).every(item => item.score === 0.72)).toBe(true);
    expect(new Set(rank(42).slice(0, 10).map(item => item.genres[0])).size).toBe(5);
  });

  it('makes pages disjoint and retains the stronger duplicate', () => {
    const ordered = rank(42);
    expect(ordered.slice(0, 10).some(item => ordered.slice(10, 20).includes(item))).toBe(false);
    const duplicates = rankRecommendations([{ ...items[0], score: 0.1 }, ...items], item => item, 42);
    expect(duplicates).toHaveLength(items.length);
    expect(duplicates.find(item => item.key === items[0].key)?.score).toBe(0.72);
  });

  it('uses media identity and the full unsigned seed range', () => {
    expect(seededValue('movie:1', 0)).not.toBe(seededValue('tv:1', 0));
    expect(seededValue('movie:1', 4294967295)).toBeGreaterThanOrEqual(0);
    expect(seededValue('movie:1', 4294967295)).toBeLessThan(1);
  });
});
