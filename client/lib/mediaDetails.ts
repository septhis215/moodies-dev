import type {
  MovieDetailsData,
  TvDetailsData,
} from "@/components/selected-content/types";

type MediaDetails = MovieDetailsData | TvDetailsData;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeMediaDetails<T extends MediaDetails>(value: unknown): T | null {
  const data = asRecord(value);
  const info = asRecord(data?.info);
  if (!data || !info) return null;

  const credits = asRecord(data.credits) ?? {};
  const providers = asRecord(data.providers) ?? {};

  return {
    ...data,
    info: {
      ...info,
      id: typeof info.id === "number" ? info.id : Number(info.id ?? 0),
      title: typeof info.title === "string" ? info.title : "Untitled",
      overview: typeof info.overview === "string" ? info.overview : "",
      release_date:
        typeof info.release_date === "string"
          ? info.release_date
          : typeof info.first_air_date === "string"
            ? info.first_air_date
            : "",
      runtime: typeof info.runtime === "number" ? info.runtime : 0,
      budget: typeof info.budget === "number" ? info.budget : 0,
      revenue: typeof info.revenue === "number" ? info.revenue : 0,
      vote_average:
        typeof info.vote_average === "number" ? info.vote_average : 0,
      vote_count: typeof info.vote_count === "number" ? info.vote_count : 0,
      genres: asArray(info.genres),
      production_companies: asArray(info.production_companies),
      production_countries: asArray(info.production_countries),
      spoken_languages: asArray(info.spoken_languages),
      status: typeof info.status === "string" ? info.status : "",
      content_type: info.content_type === "tv" ? "tv" : "movie",
    },
    credits: {
      ...credits,
      cast: asArray(credits.cast),
      crew: asArray(credits.crew),
    },
    providers: {
      ...providers,
      results: asRecord(providers.results) ?? {},
    },
  } as T;
}
