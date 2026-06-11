const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type MediaStatType = "movie" | "tv";

export interface EngagementStat {
  likeCount: number;
  savedCount: number;
  reviewCount: number;
}

export type StatsMap = Record<string, EngagementStat>;

export const ZERO_STAT: EngagementStat = {
  likeCount: 0,
  savedCount: 0,
  reviewCount: 0,
};

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function fetchMediaStatsBatch(
  items: Array<{ id: number; type: MediaStatType }>,
): Promise<StatsMap> {
  if (!items.length) return {};
  const qs = items.map((i) => `${i.id}:${i.type}`).join(",");
  const r = await fetch(
    `${API_BASE}/media-stats/batch?items=${encodeURIComponent(qs)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
