export type ResultType = "all" | "movie" | "tv" | "person";
export type SearchSort = "relevance" | "rating" | "date" | "popularity";
export interface SearchFilters {
  type: ResultType;
  sort: SearchSort;
  genres: string[];
  countries: string[];
  yearMin: string;
  yearMax: string;
  ratingMin: string;
  ratingMax: string;
  adult: boolean;
}

export const emptyFilters = (): SearchFilters => ({
  type: "all",
  sort: "relevance",
  genres: [],
  countries: [],
  yearMin: "",
  yearMax: "",
  ratingMin: "",
  ratingMax: "",
  adult: false,
});

const list = (value: string | null) =>
  [
    ...new Set(
      (value || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].sort();
const number = (
  value: string | null,
  min: number,
  max: number,
  integer = false,
) => {
  if (!value?.trim()) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= max &&
    (!integer || Number.isInteger(parsed))
    ? String(parsed)
    : "";
};

export function readFilters(
  params: Pick<URLSearchParams, "get">,
): SearchFilters {
  const type = params.get("type");
  const sort = params.get("sort");
  const filters: SearchFilters = {
    type: type === "movie" || type === "tv" || type === "person" ? type : "all",
    sort:
      sort === "rating" || sort === "date" || sort === "popularity"
        ? sort
        : "relevance",
    genres: list(params.get("genres")),
    countries: list(params.get("countries")),
    yearMin: number(params.get("year_min"), 1888, 9999, true),
    yearMax: number(params.get("year_max"), 1888, 9999, true),
    ratingMin: number(params.get("rating_min"), 0, 10),
    ratingMax: number(params.get("rating_max"), 0, 10),
    adult: params.get("include_adult") === "true",
  };
  if (
    filters.yearMin &&
    filters.yearMax &&
    Number(filters.yearMin) > Number(filters.yearMax)
  ) {
    filters.yearMin = "";
    filters.yearMax = "";
  }
  if (
    filters.ratingMin &&
    filters.ratingMax &&
    Number(filters.ratingMin) > Number(filters.ratingMax)
  ) {
    filters.ratingMin = "";
    filters.ratingMax = "";
  }
  return forType(filters, filters.type);
}

export function forType(
  filters: SearchFilters,
  type: ResultType,
): SearchFilters {
  return type === "person"
    ? {
        ...emptyFilters(),
        type,
        sort:
          filters.sort === "date" || filters.sort === "rating"
            ? "relevance"
            : filters.sort,
        adult: filters.adult,
      }
    : { ...filters, type };
}

export function searchParamsFor(
  query: string,
  filters: SearchFilters,
  page = 1,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  params.set("page", String(Math.min(25, Math.max(1, Math.trunc(page) || 1))));
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.genres.length)
    params.set("genres", [...filters.genres].sort().join(","));
  if (filters.countries.length)
    params.set("countries", [...filters.countries].sort().join(","));
  for (const [key, value] of Object.entries({
    year_min: filters.yearMin,
    year_max: filters.yearMax,
    rating_min: filters.ratingMin,
    rating_max: filters.ratingMax,
  })) {
    if (value !== "") params.set(key, value);
  }
  if (filters.adult) params.set("include_adult", "true");
  return params;
}

export function filterError(filters: SearchFilters): string | null {
  for (const value of [filters.yearMin, filters.yearMax]) {
    if (value && number(value, 1888, 9999, true) === "")
      return "Enter a whole release year between 1888 and 9999.";
  }
  if (
    filters.yearMin &&
    filters.yearMax &&
    Number(filters.yearMin) > Number(filters.yearMax)
  )
    return "From year must be earlier than or equal to To year.";
  for (const value of [filters.ratingMin, filters.ratingMax]) {
    if (value && number(value, 0, 10) === "")
      return "Ratings must be between 0 and 10.";
  }
  if (
    filters.ratingMin &&
    filters.ratingMax &&
    Number(filters.ratingMin) > Number(filters.ratingMax)
  )
    return "Minimum rating cannot exceed maximum rating.";
  return null;
}

/** Constrain a genuine query page without switching it to discovery. */
export function filterSearchPage<
  T extends {
    type: "movie" | "tv" | "person";
    release_date?: string | null;
    first_air_date?: string | null;
    vote_average?: number;
    genres?: string[];
    origin_country?: string[];
  },
>(items: T[], filters: SearchFilters): T[] {
  return items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (item.type === "person") return true;
    if (filters.yearMin || filters.yearMax) {
      const date = item.release_date || item.first_air_date;
      const year = date ? new Date(date).getUTCFullYear() : NaN;
      if (!Number.isFinite(year)) return false;
      if (filters.yearMin && year < Number(filters.yearMin)) return false;
      if (filters.yearMax && year > Number(filters.yearMax)) return false;
    }
    const rating = item.vote_average || 0;
    if (filters.ratingMin && rating < Number(filters.ratingMin)) return false;
    if (filters.ratingMax && rating > Number(filters.ratingMax)) return false;
    if (
      filters.genres.length &&
      !filters.genres.some((genre) => item.genres?.includes(genre))
    )
      return false;
    if (
      filters.countries.length &&
      !filters.countries.some((country) =>
        item.origin_country?.includes(country),
      )
    )
      return false;
    return true;
  });
}
