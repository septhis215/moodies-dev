import type { All } from "@/types/all";
import type { CommunityPulseData } from "@/types/communityPulse";

export type HomepageMediaType = "movie" | "tv";

export const pulseEndpoint = (type: HomepageMediaType) =>
  `/media-stats/community-pulse?mediaType=${type}&limit=5`;

export const upcomingEndpoint = (type: HomepageMediaType) => type === "tv"
  ? "/tv/upcoming-trailers?limit=60&months=6&perMonth=12&maxPagesPerMonth=3"
  : "/movies/upcoming-trailers?months=6&perMonth=18&maxPagesPerMonth=5";

export function readCommunityPulse(payload: unknown): CommunityPulseData {
  if (!payload || typeof payload !== "object") throw new Error("Invalid community activity");
  const data = payload as CommunityPulseData;
  if (![data.mostLiked, data.mostReviewed, data.mostSaved].every(Array.isArray)) {
    throw new Error("Invalid community activity");
  }
  return data;
}

/** Apply the same normalization to streamed data and client recovery requests. */
export function readUpcomingReleases(payload: unknown, type: HomepageMediaType): All[] {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const items = Array.isArray(payload) ? payload : record.results ?? record.items ?? record.data;
  if (!Array.isArray(items)) throw new Error("Invalid upcoming releases");
  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - 1);
  const unique = new Map<string, All>();
  for (const item of items as All[]) {
    const date = type === "tv" ? item.first_air_date || item.release_date : item.release_date;
    if (!item.id || !date || !Number.isFinite(Date.parse(date))) continue;
    if (type === "tv" && Date.parse(date) < earliest.getTime()) continue;
    if (type === "tv" && !(item.type === "tv" || item.first_air_date || item.name || item.number_of_seasons)) continue;
    unique.set(String(item.id), { ...item, type, release_date: date, ...(type === "tv" ? { first_air_date: date } : {}) });
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.release_date!) - Date.parse(b.release_date!));
}

export const readUpcomingMovies = (payload: unknown) => readUpcomingReleases(payload, "movie");
export const readUpcomingTV = (payload: unknown) => readUpcomingReleases(payload, "tv");
