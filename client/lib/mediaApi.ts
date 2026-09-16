export type MediaKind = "movie" | "tv";

export type MediaSummary = {
  id: number;
  kind: MediaKind;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string | null;
  first_air_date: string | null;
  genres: string[];
  popularity: number;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function mediaDetailsPath(kind: MediaKind, id: string | number): string {
  return `${API_BASE}/${kind === "movie" ? "movies" : "tv"}/details/${encodeURIComponent(String(id))}`;
}

function normalizeSummary(
  payload: unknown,
  kind: MediaKind,
  fallbackId: string | number,
): MediaSummary | null {
  const root = asRecord(payload);
  const info = asRecord(root.info ?? payload);
  const id = asNumber(info.id) || Number(fallbackId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const title = asString(info.title) || asString(info.name) || `${kind === "tv" ? "Series" : "Movie"} #${id}`;
  const releaseDate = asString(info.release_date) || asString(info.first_air_date) || null;

  return {
    id,
    kind,
    title,
    overview: asString(info.overview),
    poster_path: typeof info.poster_path === "string" ? info.poster_path : null,
    backdrop_path: typeof info.backdrop_path === "string" ? info.backdrop_path : null,
    vote_average: asNumber(info.vote_average),
    vote_count: asNumber(info.vote_count),
    release_date: kind === "movie" ? releaseDate : null,
    first_air_date: kind === "tv" ? releaseDate : null,
    genres: asStringArray(info.genres).length
      ? asStringArray(info.genres)
      : Array.isArray(info.genres)
        ? info.genres
            .map((genre) => asString(asRecord(genre).name))
            .filter(Boolean)
        : [],
    popularity: asNumber(info.popularity),
  };
}

export async function fetchMediaSummary(
  kind: MediaKind,
  id: string | number,
  init?: RequestInit,
): Promise<MediaSummary | null> {
  try {
    const response = await fetch(mediaDetailsPath(kind, id), {
      ...init,
      headers: { accept: "application/json", ...init?.headers },
    });
    if (!response.ok) return null;
    return normalizeSummary(await response.json(), kind, id);
  } catch {
    return null;
  }
}

export async function fetchMediaSummaries(
  items: Array<{ kind: MediaKind; id: string | number }>,
  init?: RequestInit,
): Promise<MediaSummary[]> {
  const uniqueItems = Array.from(
    new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values(),
  );
  const results: Array<MediaSummary | null> = [];
  let nextIndex = 0;
  const workerCount = Math.min(8, uniqueItems.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < uniqueItems.length) {
      const index = nextIndex++;
      const item = uniqueItems[index];
      results[index] = await fetchMediaSummary(item.kind, item.id, init);
    }
  });

  await Promise.all(workers);
  return results.filter((item): item is MediaSummary => item !== null);
}

export function getMediaApiBase(): string {
  return API_BASE;
}
