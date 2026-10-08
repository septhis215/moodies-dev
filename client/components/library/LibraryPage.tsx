"use client";

import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bookmark,
  LayoutGrid,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { LibraryCard } from "./LibraryCard";
import { LibraryHero } from "./LibraryHero";
import styles from "./LibraryPage.module.css";
import { useLibrary } from "./useLibrary";
import {
  emptyLibraryFilters,
  entryKey,
  filterLibrary,
  libraryFilterError,
  type LibraryFilters,
  type LibraryKind,
} from "./library-state";

const controlClass =
  "min-h-11 min-w-0 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]";
const sorts = [
  { value: "date_desc", label: "Newest release" },
  { value: "date_asc", label: "Oldest release" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "rating_asc", label: "Lowest rated" },
] as const;

export default function LibraryPage({ kind }: { kind: LibraryKind }) {
  const library = useLibrary(kind);
  const [filters, setFilters] = useState<LibraryFilters>(emptyLibraryFilters);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const title = kind === "watchlist" ? "Watchlist" : "Liked titles";
  const [view, setView] = useState<"cards" | "posters">("cards");
  const filtered = useMemo(
    () => filterLibrary(library.entries, filters),
    [library.entries, filters],
  );
  const filterError = libraryFilterError(filters);
  const rangeCount = [
    filters.yearMin,
    filters.yearMax,
    filters.ratingMin,
    filters.ratingMax,
  ].filter((value) => value !== "").length;
  const activeFilters = Boolean(
    filters.search.trim() || filters.format !== "all" || rangeCount,
  );
  const loading =
    library.authLoading ||
    (library.signedIn &&
      (library.phase === "list" || library.phase === "details"));
  const unavailable = library.entries.filter((entry) => !entry.summary).length;
  const movieCount = library.entries.filter(
    (entry) => entry.kind === "movie",
  ).length;
  const seriesCount = library.entries.length - movieCount;
  const change = <K extends keyof LibraryFilters>(
    key: K,
    value: LibraryFilters[K],
  ) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setVisibleCount(12);
  };
  const reset = () => {
    setFilters(emptyLibraryFilters());
    setVisibleCount(12);
  };

  return (
    <section
      aria-labelledby="library-heading"
      className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]"
    >
      <div className="ui-shell pb-12 pt-6 sm:pt-10 lg:pt-24">
        <LibraryHero
          kind={kind}
          entries={library.entries}
          displayName={library.displayName}
          ready={library.signedIn && !loading && library.phase === "ready"}
        />

        {library.authLoading ? (
          <LoadingGrid label="Checking your account…" view={view} />
        ) : !library.signedIn ? (
          <LibraryState
            title={
              "Sign in for your " +
              (kind === "watchlist" ? "watchlist" : "liked titles")
            }
            note="Your personal library is waiting for you."
            href="/auth/login"
            action="Sign in"
          />
        ) : library.phase === "error" ? (
          <LibraryState
            title={
              "Couldn’t load your " +
              (kind === "watchlist" ? "watchlist" : "liked titles")
            }
            note="Please try again. Your saved titles have not been changed."
            onAction={library.retry}
            action="Retry library"
          />
        ) : (
          <>
            <div
              role="search"
              aria-label={"Search " + title.toLowerCase()}
              className="grid gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 shadow-[0_14px_40px_rgba(0,0,0,0.16)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-4 "
            >
              <div className="relative min-w-0">
                <label htmlFor="library-search" className="sr-only">
                  Search titles
                </label>
                <Search
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--ink-muted)]"
                  aria-hidden="true"
                />
                <input
                  id="library-search"
                  type="search"
                  value={filters.search}
                  onChange={(event) => change("search", event.target.value)}
                  placeholder="Search titles"
                  className={
                    controlClass +
                    " w-full pl-9 pr-12 [&::-webkit-search-cancel-button]:appearance-none"
                  }
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => change("search", "")}
                    aria-label="Clear title search"
                    className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:contents">
                <div className="relative">
                  <label className="sr-only" htmlFor="library-sort">
                    Sort titles
                  </label>
                  <select
                    id="library-sort"
                    value={filters.sort}
                    onChange={(event) =>
                      change(
                        "sort",
                        event.target.value as LibraryFilters["sort"],
                      )
                    }
                    className={
                      controlClass + " w-full appearance-none pr-9 sm:w-44"
                    }
                  >
                    {sorts.map((sort) => (
                      <option key={sort.value} value={sort.value}>
                        {sort.label}
                      </option>
                    ))}
                  </select>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--brand-coral-strong)]"
                  >
                    ▾
                  </span>
                </div>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="library-ranges"
                  onClick={() => setExpanded((current) => !current)}
                  className={`${controlClass} inline-flex items-center justify-center gap-2 font-semibold ${expanded ? "border-[var(--brand-coral)] bg-[var(--surface-2)] text-[var(--brand-coral-strong)]" : ""}`}
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  Filters
                  {rangeCount > 0 && (
                    <span className="text-[var(--brand-coral-strong)]">
                      ({rangeCount})
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div
              id="library-ranges"
              hidden={!expanded}
              className="mt-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.14)] sm:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <RangeFields
                  label="Release year"
                  prefix="year"
                  values={[filters.yearMin, filters.yearMax]}
                  min={1870}
                  max={9999}
                  onChange={([lower, upper]) => {
                    setFilters((current) => ({
                      ...current,
                      yearMin: lower,
                      yearMax: upper,
                    }));
                    setVisibleCount(12);
                  }}
                  invalid={Boolean(filterError)}
                />
                <RangeFields
                  label="Rating"
                  prefix="rating"
                  values={[filters.ratingMin, filters.ratingMax]}
                  min={0}
                  max={10}
                  step={0.1}
                  onChange={([lower, upper]) => {
                    setFilters((current) => ({
                      ...current,
                      ratingMin: lower,
                      ratingMax: upper,
                    }));
                    setVisibleCount(12);
                  }}
                  invalid={Boolean(filterError)}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                Titles with unknown years or ratings are excluded when those
                ranges are set.
              </p>
              {filterError && (
                <p
                  id="library-filter-error"
                  role="alert"
                  className="mt-2 text-sm text-[var(--brand-coral-strong)]"
                >
                  {filterError}
                </p>
              )}
            </div>
            <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[var(--surface-border)] pb-4">
              <div
                role="group"
                aria-label="Filter by format"
                className="flex min-w-0 flex-wrap gap-1 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-1"
              >
                {(
                  [
                    ["all", "All"],
                    ["movie", "Movies"],
                    ["tv", "Series"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filters.format === value}
                    onClick={() => change("format", value)}
                    className={
                      "min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] " +
                      (filters.format === value
                        ? "bg-[var(--brand-coral)] text-white shadow-sm"
                        : "text-[var(--ink-muted)] hover:text-[var(--ink)]")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {activeFilters ? (
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                >
                  Reset filters
                </button>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">
                  <span className="sm:hidden">
                    {library.entries.length} titles
                  </span>
                  <span className="hidden sm:inline">
                    {movieCount} movies · {seriesCount} series
                  </span>
                </p>
              )}
            </div>

            {loading ? (
              <LoadingGrid
                view={view}
                label={
                  library.phase === "details"
                    ? "Loading title details: " +
                      library.completed +
                      " of " +
                      library.entries.length
                    : "Loading your library…"
                }
              />
            ) : (
              <>
                {unavailable > 0 && (
                  <div
                    role="status"
                    className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-4 py-2"
                  >
                    <p className="text-sm leading-6 text-[var(--ink-muted)]">
                      {unavailable}{" "}
                      {unavailable === 1 ? "title could" : "titles could"} not
                      load details. They remain in your library.
                    </p>
                    <button
                      type="button"
                      disabled={library.busy.size > 0}
                      onClick={library.retry}
                      className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:opacity-60"
                    >
                      Retry details
                    </button>
                  </div>
                )}
                {library.entries.length === 0 ? (
                  <LibraryState
                    title={
                      kind === "watchlist"
                        ? "Your watchlist is empty"
                        : "No liked titles yet"
                    }
                    note={
                      kind === "watchlist"
                        ? "Save a movie or series and it will be here when you are ready."
                        : "Like a movie or series to keep your favourites together."
                    }
                    href="/moods"
                    action="Find your next watch"
                  />
                ) : filterError ? (
                  <LibraryState
                    title="Check your filter ranges"
                    note={filterError}
                    onAction={reset}
                    action="Reset filters"
                  />
                ) : filtered.length === 0 ? (
                  <LibraryState
                    title="No matching titles"
                    note="Try another title, format or range. Your library has not changed."
                    onAction={reset}
                    action="Reset filters"
                  />
                ) : (
                  <section aria-label={title + " results"}>
                    <p role="status" className="sr-only">
                      Showing {Math.min(visibleCount, filtered.length)} of{" "}
                      {filtered.length} titles
                    </p>
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="ui-kicker">Your shelf</p>
                        <h2 className="mt-2 text-2xl font-bold leading-none text-[var(--ink)] sm:text-3xl">
                          {filters.format === "movie"
                            ? kind === "watchlist"
                              ? "Saved movies"
                              : "Movies you liked"
                            : filters.format === "tv"
                              ? kind === "watchlist"
                                ? "Saved series"
                                : "Series you liked"
                              : kind === "watchlist"
                                ? "Ready when you are"
                                : "Stories you loved"}
                        </h2>
                      </div>
                      <div
                        role="group"
                        aria-label="Library display"
                        className={styles.viewToggle}
                      >
                        <button
                          type="button"
                          aria-label="Card view"
                          aria-pressed={view === "cards"}
                          onClick={() => setView("cards")}
                          className={styles.viewButton}
                        >
                          <Rows3 size={16} aria-hidden="true" /> Cards
                        </button>
                        <button
                          type="button"
                          aria-label="Poster view"
                          aria-pressed={view === "posters"}
                          onClick={() => setView("posters")}
                          className={styles.viewButton}
                        >
                          <LayoutGrid size={16} aria-hidden="true" /> Posters
                        </button>
                      </div>
                    </div>
                    <div
                      className={
                        view === "cards" ? styles.cards : styles.posters
                      }
                      data-library-view={view}
                    >
                      {filtered.slice(0, visibleCount).map((entry) => (
                        <LibraryCard
                          key={entryKey(entry)}
                          entry={entry}
                          view={view}
                          kind={kind}
                          busy={library.busy.has(entryKey(entry))}
                          onRemove={() => void library.remove(entry)}
                        />
                      ))}
                    </div>
                    {visibleCount < filtered.length && (
                      <div className="mt-6 flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCount((current) => current + 12)
                          }
                          className="ui-secondary-action min-h-11"
                        >
                          View {Math.min(12, filtered.length - visibleCount)}{" "}
                          more titles
                        </button>
                        <p className="text-sm text-[var(--ink-muted)]">
                          Showing {visibleCount} of {filtered.length}
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RangeFields({
  label,
  prefix,
  values,
  min,
  max,
  step = 1,
  invalid,
  onChange,
}: {
  label: string;
  prefix: string;
  values: [string, string];
  min: number;
  max: number;
  step?: number;
  invalid: boolean;
  onChange: (values: [string, string]) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["Minimum", "Maximum"] as const).map((bound, index) => (
          <div key={bound} className="min-w-0">
            <label
              htmlFor={prefix + "-" + index}
              className="mb-1 block text-xs text-[var(--ink-muted)]"
            >
              {bound}
            </label>
            <input
              id={prefix + "-" + index}
              type="number"
              min={min}
              max={max}
              step={step}
              inputMode={prefix === "year" ? "numeric" : "decimal"}
              value={values[index]}
              aria-invalid={invalid}
              aria-describedby={invalid ? "library-filter-error" : undefined}
              placeholder="Any"
              onChange={(event) =>
                onChange(
                  index === 0
                    ? [event.target.value, values[1]]
                    : [values[0], event.target.value],
                )
              }
              className={controlClass + " w-full"}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function LibraryState({
  title,
  note,
  action,
  href,
  onAction,
}: {
  title: string;
  note: string;
  action: string;
  href?: string;
  onAction?: () => void;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[linear-gradient(120deg,rgba(255,255,255,0.035),transparent_60%),var(--surface-1)] p-7 shadow-[0_20px_55px_rgba(0,0,0,0.18)] sm:p-10"
      aria-label={title}
    >
      <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] text-[var(--brand-coral-strong)]">
        <Bookmark className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
        {note}
      </p>
      {href ? (
        <Link
          href={href}
          className="ui-primary-action mt-5 min-h-11 text-[var(--surface-0)] shadow-none hover:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          {action}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onAction}
          className="ui-secondary-action mt-5 min-h-11"
        >
          {action}
        </button>
      )}
    </section>
  );
}
function LoadingGrid({
  label,
  view,
}: {
  label: string;
  view: "cards" | "posters";
}) {
  return (
    <div aria-busy="true">
      <p role="status" className="mb-4 text-sm text-[var(--ink-muted)]">
        {label}
      </p>
      <div
        aria-hidden="true"
        className={view === "cards" ? styles.cards : styles.posters}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className={`${styles.card} ${view === "posters" ? styles.posterCard : ""}`}
          >
            <Skeleton className={styles.poster} />
            <div className={styles.copy}>
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-3 h-3 w-3/4" />
              <Skeleton className="mt-8 h-8 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
