export interface RankingSignals {
  key: string;
  score: number;
  genres: number[];
  language?: string;
  type?: string;
  year?: string;
  collection?: string | number;
}

export function seededValue(key: string, seed: number): number {
  let hash = seed | 0;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

/** Diversity only breaks ties within a relevance band. Input order is immaterial. */
export function rankRecommendations<T>(
  items: T[],
  signals: (item: T) => RankingSignals,
  seed: number,
  bandSize = 0.05,
): T[] {
  const unique = new Map<string, { item: T; signals: RankingSignals }>();
  for (const item of items) {
    const info = signals(item);
    const previous = unique.get(info.key);
    if (!previous || info.score > previous.signals.score) unique.set(info.key, { item, signals: info });
  }
  const bands = new Map<number, Array<{ item: T; signals: RankingSignals }>>();
  for (const entry of unique.values()) {
    const band = Math.floor(entry.signals.score / bandSize);
    const bucket = bands.get(band) ?? [];
    bucket.push(entry);
    bands.set(band, bucket);
  }
  const counts = new Map<string, number>();
  let previous: RankingSignals | undefined;
  const dimensions = (s: RankingSignals) => [
    ...s.genres.map(id => `genre:${id}`),
    ...(s.language ? [`language:${s.language}`] : []),
    ...(s.type ? [`type:${s.type}`] : []),
    ...(s.year ? [`decade:${s.year.slice(0, 3)}`] : []),
    ...(s.collection ? [`collection:${s.collection}`] : []),
  ];
  const result: T[] = [];
  for (const [, bucket] of [...bands].sort(([a], [b]) => b - a)) {
    while (bucket.length) {
      const utility = (s: RankingSignals) => seededValue(s.key, seed)
        - dimensions(s).reduce((sum, key) => sum + (counts.get(key) ?? 0) * (key.startsWith('collection:') ? 0.7 : 0.08), 0)
        - (previous && s.genres.some(id => previous!.genres.includes(id)) ? 0.25 : 0);
      bucket.sort((a, b) => utility(b.signals) - utility(a.signals) || a.signals.key.localeCompare(b.signals.key));
      const entry = bucket.shift()!;
      result.push(entry.item);
      for (const key of dimensions(entry.signals)) counts.set(key, (counts.get(key) ?? 0) + 1);
      previous = entry.signals;
    }
  }
  return result;
}
