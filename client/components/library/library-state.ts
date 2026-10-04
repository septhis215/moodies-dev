import type { MediaKind, MediaSummary } from "@/lib/mediaApi";

export type LibraryKind = "watchlist" | "liked";
export type LibraryEntry = {
  id: string;
  kind: MediaKind;
  order: number;
  summary: MediaSummary | null;
};
export type LibraryFilters = {
  search: string;
  format: "all" | MediaKind;
  sort: "date_desc" | "date_asc" | "rating_desc" | "rating_asc";
  yearMin: string;
  yearMax: string;
  ratingMin: string;
  ratingMax: string;
};
export const emptyLibraryFilters = (): LibraryFilters => ({
  search: "",
  format: "all",
  sort: "date_desc",
  yearMin: "",
  yearMax: "",
  ratingMin: "",
  ratingMax: "",
});
export const entryKey = (entry: Pick<LibraryEntry, "kind" | "id">) =>
  entry.kind + ":" + entry.id;
export const entryTitle = (entry: LibraryEntry) =>
  entry.summary?.title ??
  (entry.kind === "movie" ? "Movie #" : "Series #") + entry.id;
export const entryDate = (entry: LibraryEntry) =>
  entry.summary?.release_date || entry.summary?.first_air_date || "";

export function libraryFilterError(filters: LibraryFilters): string | null {
  const fields = [
    filters.yearMin,
    filters.yearMax,
    filters.ratingMin,
    filters.ratingMax,
  ];
  if (fields.some((value) => value !== "" && !Number.isFinite(Number(value))))
    return "Enter valid numbers for the ranges.";
  if (
    [filters.yearMin, filters.yearMax].some(
      (value) =>
        value !== "" &&
        (!Number.isInteger(Number(value)) ||
          Number(value) < 1870 ||
          Number(value) > 9999),
    )
  )
    return "Enter a year between 1870 and 9999.";
  if (
    [filters.ratingMin, filters.ratingMax].some(
      (value) => value !== "" && (Number(value) < 0 || Number(value) > 10),
    )
  )
    return "Ratings must be between 0 and 10.";
  if (
    filters.yearMin !== "" &&
    filters.yearMax !== "" &&
    Number(filters.yearMin) > Number(filters.yearMax)
  )
    return "The earliest year cannot be later than the latest year.";
  if (
    filters.ratingMin !== "" &&
    filters.ratingMax !== "" &&
    Number(filters.ratingMin) > Number(filters.ratingMax)
  )
    return "The minimum rating cannot be higher than the maximum rating.";
  return null;
}

/** Unknown dates/ratings remain browsable, but cannot satisfy an explicit range. */
export function filterLibrary(
  entries: LibraryEntry[],
  filters: LibraryFilters,
): LibraryEntry[] {
  if (libraryFilterError(filters)) return [];
  const query = filters.search.trim().toLowerCase();
  return entries
    .filter((entry) => {
      if (filters.format !== "all" && entry.kind !== filters.format)
        return false;
      if (query && !entryTitle(entry).toLowerCase().includes(query))
        return false;
      const date = entryDate(entry);
      const year = date ? Number(date.slice(0, 4)) : null;
      const rating = entry.summary?.vote_average || null;
      if (filters.yearMin !== "" || filters.yearMax !== "") {
        if (year === null || !Number.isFinite(year)) return false;
        if (filters.yearMin !== "" && year < Number(filters.yearMin))
          return false;
        if (filters.yearMax !== "" && year > Number(filters.yearMax))
          return false;
      }
      if (filters.ratingMin !== "" || filters.ratingMax !== "") {
        if (rating === null) return false;
        if (filters.ratingMin !== "" && rating < Number(filters.ratingMin))
          return false;
        if (filters.ratingMax !== "" && rating > Number(filters.ratingMax))
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ratingSort = filters.sort.startsWith("rating");
      const aValue = ratingSort
        ? a.summary?.vote_average || null
        : entryDate(a) || null;
      const bValue = ratingSort
        ? b.summary?.vote_average || null
        : entryDate(b) || null;
      // Missing metadata is always last, including ascending sorts.
      if (aValue === null && bValue !== null) return 1;
      if (bValue === null && aValue !== null) return -1;
      if (aValue === null && bValue === null) return a.order - b.order;
      const difference = ratingSort
        ? Number(aValue) - Number(bValue)
        : String(aValue).localeCompare(String(bValue));
      return (
        (filters.sort.endsWith("desc") ? -difference : difference) ||
        a.order - b.order
      );
    });
}

/** Restore only the failed title: another successful removal stays removed. */
export function restoreLibraryEntry(
  entries: LibraryEntry[],
  removed: LibraryEntry,
): LibraryEntry[] {
  if (entries.some((entry) => entryKey(entry) === entryKey(removed)))
    return entries;
  return [...entries, removed].sort((a, b) => a.order - b.order);
}
