"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grid3X3, List, Search, SlidersHorizontal, X } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { RatingBadge } from "@/components/ui/rating-badge";
import Pagination from "@/components/ui/pagination";
import { tmdbImage } from "@/lib/tmdb";
import {
  emptyFilters,
  filterError,
  filterSearchPage,
  forType,
  readFilters,
  searchParamsFor,
  type ResultType,
  type SearchFilters,
  type SearchSort,
} from "./search-state";
import styles from "./search.module.css";

interface SearchResult {
  id: number;
  type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  known_for_department?: string;
  genres?: string[];
  origin_country?: string[];
}
interface SearchResponse {
  results: SearchResult[];
  total_results: number;
  total_pages: number;
  status?: "success" | "empty" | "partial" | "error";
  is_partial?: boolean;
  error?: string;
}
interface Country {
  code: string;
  name: string;
}
const BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];
const COUNTRIES: Country[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "FR", name: "France" },
];
const TYPES: { value: ResultType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "person", label: "People" },
];
const hrefFor = (item: SearchResult) =>
  item.type === "person"
    ? `/celeb/${item.id}`
    : `/${item.type === "movie" ? "movies" : "tv"}/${item.id}`;

export default function SearchResultsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const routeKey = params.toString();
  const applied = useMemo(
    () => readFilters(new URLSearchParams(routeKey)),
    [routeKey],
  );
  const query = params.get("q")?.trim() || "";
  const requestedPage = Number(params.get("page"));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? Math.min(25, requestedPage)
      : 1;
  const requestParams = searchParamsFor(query, applied, page).toString();
  const [searchText, setSearchText] = useState(query);
  const [draft, setDraft] = useState<SearchFilters>(applied);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [response, setResponse] = useState<{
    key: string;
    data: SearchResponse;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  const [genres, setGenres] = useState(GENRES);
  const [countries, setCountries] = useState(COUNTRIES);
  const [countrySearch, setCountrySearch] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const lastQuery = useRef(query);
  const restoreScroll = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (lastQuery.current !== query) {
      lastQuery.current = query;
      setSearchText(query);
    }
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [query, routeKey]);

  useEffect(() => {
    const controller = new AbortController();
    for (const kind of ["genres", "countries"] as const) {
      fetch(`${BASE}/search/${kind}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("Filter metadata unavailable");
          return res.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (
            kind === "genres" &&
            Array.isArray(data.genres) &&
            data.genres.every((v: unknown) => typeof v === "string")
          )
            setGenres(data.genres);
          if (
            kind === "countries" &&
            Array.isArray(data.countries) &&
            data.countries.every(
              (v: Country) =>
                typeof v?.code === "string" && typeof v?.name === "string",
            )
          )
            setCountries(data.countries);
        })
        .catch(() => {
          /* Retain usable fallback options if metadata is unavailable. */
        });
    }
    return () => controller.abort();
  }, []);

  const hasTitleFilters =
    applied.genres.length > 0 ||
    applied.countries.length > 0 ||
    Boolean(
      applied.yearMin ||
      applied.yearMax ||
      applied.ratingMin ||
      applied.ratingMax,
    );
  const shouldFetch =
    (Boolean(query) || applied.type !== "person") &&
    Boolean(
      query ||
      hasTitleFilters ||
      applied.type !== "all" ||
      applied.sort !== "relevance" ||
      applied.adult,
    );
  useEffect(() => {
    if (!shouldFetch) return;
    const controller = new AbortController();
    // Text search must not silently become queryless catalogue discovery.
    const endpoint = query ? "search" : "search/discover";
    const apiParams = new URLSearchParams(requestParams);
    // The discovery DTO defaults to movies; keep the visible All selection truthful.
    apiParams.set("type", applied.type);
    // Older deployed APIs switch filtered searches to discovery. Fetch a genuine
    // query page and apply constraints locally, so the UI also works before deployment.
    if (query)
      for (const key of [
        "genres",
        "countries",
        "year_min",
        "year_max",
        "rating_min",
        "rating_max",
      ])
        apiParams.delete(key);
    fetch(`${BASE}/${endpoint}?${apiParams}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok)
          throw new Error("Couldn't load these results. Please try again.");
        const data: SearchResponse = await res.json();
        if (data.status === "error")
          throw new Error(
            data.error || "Couldn't load these results. Please try again.",
          );
        if (!controller.signal.aborted) {
          setResponse({ key: requestParams, data });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError({
            key: requestParams,
            message:
              cause instanceof Error
                ? cause.message
                : "Couldn't load these results.",
          });
      });
    return () => controller.abort();
  }, [query, requestParams, shouldFetch, retry, applied.type]);

  useEffect(() => () => restoreScroll.current?.(), []);
  const data = response?.key === requestParams ? response.data : null;
  const currentError = error?.key === requestParams ? error.message : null;
  const loading = shouldFetch && !data && !currentError;
  const results = query
    ? filterSearchPage(data?.results || [], applied)
    : data?.results || [];
  const availablePages = Math.min(25, data?.total_pages || 0);

  function commit(next: SearchFilters, nextPage = 1, nextQuery = query) {
    const nextParams = searchParamsFor(
      nextQuery,
      forType(next, next.type),
      nextPage,
    ).toString();
    if (nextParams !== requestParams)
      router.push(`/search?${nextParams}`, { scroll: false });
  }
  function closeFilters() {
    dialogRef.current?.close();
  }
  function onFiltersClosed() {
    restoreScroll.current?.();
    restoreScroll.current = null;
    filterTrigger.current?.focus({ preventScroll: true });
  }
  function openFilters() {
    setDraft({
      ...applied,
      genres: [...applied.genres],
      countries: [...applied.countries],
    });
    setCountrySearch("");
    setValidation(null);
    dialogRef.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    restoreScroll.current = () => {
      document.body.style.overflow = previousOverflow;
    };
  }
  function toggle(key: "genres" | "countries", value: string) {
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }
  const commonGenreNames = [
    "Drama",
    "Comedy",
    "Action",
    "Thriller",
    "Crime",
    "Romance",
    "Animation",
    "Documentary",
  ];
  const primaryGenres = [
    ...new Set([
      ...draft.genres,
      ...commonGenreNames.filter((genre) => genres.includes(genre)),
    ]),
  ];
  const remainingGenres = genres.filter(
    (genre) => !primaryGenres.includes(genre),
  );
  const genreOption = (genre: string) => (
    <label key={genre} className={styles.option}>
      <input
        type="checkbox"
        checked={draft.genres.includes(genre)}
        onChange={() => toggle("genres", genre)}
      />
      <span>{genre}</span>
    </label>
  );
  const countryName = (code: string) =>
    countries.find((c) => c.code === code)?.name || code;
  const constraints: { label: string; clear: () => void }[] = [
    ...(applied.genres.length
      ? [
          {
            label: applied.genres.join(" or "),
            clear: () => commit({ ...applied, genres: [] }),
          },
        ]
      : []),
    ...(applied.countries.length
      ? [
          {
            label: applied.countries.map(countryName).join(" or "),
            clear: () => commit({ ...applied, countries: [] }),
          },
        ]
      : []),
    ...(applied.yearMin || applied.yearMax
      ? [
          {
            label:
              applied.yearMin && applied.yearMax
                ? `${applied.yearMin}–${applied.yearMax}`
                : applied.yearMin
                  ? `Since ${applied.yearMin}`
                  : `Through ${applied.yearMax}`,
            clear: () => commit({ ...applied, yearMin: "", yearMax: "" }),
          },
        ]
      : []),
    ...(applied.ratingMin || applied.ratingMax
      ? [
          {
            label: `Rating ${applied.ratingMin || "0"}–${applied.ratingMax || "10"}`,
            clear: () => commit({ ...applied, ratingMin: "", ratingMax: "" }),
          },
        ]
      : []),
    ...(applied.adult
      ? [
          {
            label: "Adult titles included",
            clear: () => commit({ ...applied, adult: false }),
          },
        ]
      : []),
  ];
  const shownCountries = countries
    .filter(
      (c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(draft.countries.includes(b.code)) -
        Number(draft.countries.includes(a.code)),
    );
  const control = styles.button;

  return (
    <main className={styles.page}>
      <div className="ui-shell">
        <header className={styles.header}>
          <p className="ui-kicker mb-2">Find your next watch</p>
          <h1 className={styles.heading}>
            {query
              ? `Search results for “${query}”`
              : "Find movies, TV and people"}
          </h1>
          <form
            role="search"
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              commit(applied, 1, searchText);
            }}
          >
            <label htmlFor="search-query" className="sr-only">
              Search movies, TV and people
            </label>
            <input
              id="search-query"
              type="search"
              className={styles.input}
              placeholder="A title, a series, a person…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <button
              type="submit"
              className={`${control} ${styles.primary}`}
              aria-label="Search"
            >
              <Search size={20} aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </header>
        <div className={styles.types} role="group" aria-label="Result type">
          {TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={control}
              aria-pressed={applied.type === value}
              disabled={!query && value === "person"}
              onClick={() => commit(forType(applied, value))}
            >
              {label}
            </button>
          ))}
        </div>
        {!query && (
          <p className={`${styles.muted} mb-4`}>
            Search a name to find people, or choose filters to explore the
            catalogue.
          </p>
        )}
        <div className={styles.toolbar}>
          <button
            ref={filterTrigger}
            type="button"
            className={control}
            aria-haspopup="dialog"
            aria-controls="search-filters"
            onClick={openFilters}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            Filters
            {constraints.length > 0 && <span>({constraints.length})</span>}
          </button>
          <label className={`${styles.field} ${styles.sort}`}>
            Sort{query && " this page"}
            <select
              className={styles.input}
              value={applied.sort}
              onChange={(event) =>
                commit({ ...applied, sort: event.target.value as SearchSort })
              }
            >
              <option value="relevance">
                {query ? "Most relevant" : "Popular"}
              </option>
              {applied.type !== "person" && (
                <>
                  <option value="rating">Highest rated</option>
                  <option value="date">Newest releases</option>
                </>
              )}
              <option value="popularity">Most popular</option>
            </select>
          </label>
          <div
            className={styles.views}
            role="group"
            aria-label="Results layout"
          >
            <button
              type="button"
              className={control}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <Grid3X3 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={control}
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        {constraints.length > 0 && (
          <div
            className={styles.constraints}
            role="group"
            aria-label="Applied filters"
          >
            {constraints.map(({ label, clear }) => (
              <button
                type="button"
                key={label}
                className={control}
                onClick={clear}
                aria-label={`Remove filter: ${label}`}
              >
                {label}
                <X size={14} aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              className={control}
              onClick={() =>
                commit({
                  ...emptyFilters(),
                  type: applied.type,
                  sort: applied.sort,
                })
              }
            >
              Clear all filters
            </button>
          </div>
        )}
        <section
          ref={resultsRef}
          aria-labelledby="results-heading"
          aria-busy={loading}
        >
          <div className={styles.resultsHeader}>
            <h2 id="results-heading">
              {query ? "Results" : "Explore the catalogue"}
            </h2>
            <p className={styles.muted} role="status" aria-live="polite">
              {loading
                ? "Searching…"
                : currentError
                  ? "Search unavailable"
                  : data
                    ? `${results.length} ${results.length === 1 ? "match" : "matches"} on page ${page}`
                    : "Ready when you are"}
            </p>
          </div>
          {query && data && (
            <p className={`${styles.muted} mb-5`}>
              {data.total_results >= 500 ? "500+" : data.total_results} upstream
              matches before filters. Filters and sorting apply to this page
              {applied.type === "all" && hasTitleFilters
                ? "; title filters do not apply to people"
                : ""}
              .
            </p>
          )}
          {data?.is_partial && (
            <p role="status" className={`${styles.muted} mb-4`}>
              Some sources are unavailable. These are the results we could load.
            </p>
          )}
          {currentError ? (
            <div className={styles.empty}>
              <h2>Couldn’t load your search</h2>
              <p className={styles.muted}>{currentError}</p>
              <button
                className={control}
                onClick={() => {
                  setError(null);
                  setResponse(null);
                  setRetry((v) => v + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className={styles.grid} aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <div key={index} className={styles.skeleton} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className={view === "grid" ? styles.grid : styles.list}>
              {results.map((item) => {
                const title = item.title || item.name || "Untitled";
                const image =
                  tmdbImage(
                    item.type === "person"
                      ? item.profile_path
                      : item.poster_path,
                    "posterCard",
                  ) ||
                  (item.type === "person"
                    ? "/placeholder-person.svg"
                    : "/placeholder-poster.svg");
                const year = (item.release_date || item.first_air_date)?.slice(
                  0,
                  4,
                );
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={hrefFor(item)}
                    className={styles.card}
                  >
                    <div className={styles.poster}>
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes={
                          view === "list"
                            ? "80px"
                            : "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw"
                        }
                      />
                      {item.type !== "person" && (
                        <div
                          className={styles.rating}
                          aria-label={`TMDB rating ${item.vote_average || 0} out of 10`}
                        >
                          <RatingBadge rating={item.vote_average} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3>{title}</h3>
                      <p className={styles.meta}>
                        {item.type === "person"
                          ? item.known_for_department || "Person"
                          : `${item.type === "movie" ? "Movie" : "TV series"} · ${year || "Date TBA"}`}
                      </p>
                      {view === "list" && item.overview && (
                        <p className={styles.overview}>{item.overview}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <h2>
                {data
                  ? "No matches on this page"
                  : "Start with a title or a feeling"}
              </h2>
              <p className={styles.muted}>
                {data
                  ? "Try another page, remove a filter, or edit your search."
                  : "Search for something you know, or choose a genre to discover something new."}
              </p>
              {constraints.length > 0 && (
                <button
                  className={control}
                  onClick={() =>
                    commit({
                      ...emptyFilters(),
                      type: applied.type,
                      sort: applied.sort,
                    })
                  }
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
          {data && availablePages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={availablePages}
              className="mt-8"
              onPageChange={(nextPage) => {
                commit(applied, nextPage);
                resultsRef.current?.scrollIntoView({
                  behavior: "auto",
                  block: "start",
                });
              }}
            />
          )}
        </section>
      </div>
      <dialog
        id="search-filters"
        ref={dialogRef}
        className={styles.drawer}
        aria-labelledby="filter-heading"
        onClose={onFiltersClosed}
        onCancel={() => setValidation(null)}
        onClick={(event) => {
          if (
            event.target === event.currentTarget &&
            event.clientX < event.currentTarget.getBoundingClientRect().left
          )
            closeFilters();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const message = filterError(draft);
            if (message) {
              setValidation(message);
              return;
            }
            commit(draft);
            closeFilters();
          }}
        >
          <header className={styles.drawerHeader}>
            <h2 id="filter-heading">Filters</h2>
            <button
              autoFocus
              type="button"
              className={control}
              aria-label="Close filters without applying"
              onClick={closeFilters}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className={styles.drawerBody}>
            {draft.type === "person" ? (
              <p className={styles.muted}>
                People don’t have release years, genres or title ratings. Use
                the search field to find a name.
              </p>
            ) : (
              <>
                {draft.type === "all" && (
                  <p className={`${styles.muted} mb-5`}>
                    Year, genre, country and rating filters apply to movies and
                    TV, not people.
                  </p>
                )}
                <fieldset
                  className={styles.group}
                  aria-describedby="genre-help"
                >
                  <legend>Genres</legend>
                  <p id="genre-help" className={styles.muted}>
                    Match any selected genre.
                  </p>
                  <div className={styles.options}>
                    {primaryGenres.map(genreOption)}
                  </div>
                  {remainingGenres.length > 0 && (
                    <details className={styles.more}>
                      <summary>More genres</summary>
                      <div className={styles.options}>
                        {remainingGenres.map(genreOption)}
                      </div>
                    </details>
                  )}
                </fieldset>
                <fieldset className={styles.group}>
                  <legend>Release year</legend>
                  <p className={`${styles.muted} mb-3`}>
                    Any year unless you set a boundary.
                  </p>
                  <div className={styles.range}>
                    <label className={styles.field}>
                      From
                      <input
                        className={styles.input}
                        type="number"
                        min={1888}
                        max={9999}
                        step={1}
                        placeholder="Any year"
                        value={draft.yearMin}
                        onChange={(event) => {
                          setValidation(null);
                          setDraft({ ...draft, yearMin: event.target.value });
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      To
                      <input
                        className={styles.input}
                        type="number"
                        min={1888}
                        max={9999}
                        step={1}
                        placeholder="Any year"
                        value={draft.yearMax}
                        onChange={(event) => {
                          setValidation(null);
                          setDraft({ ...draft, yearMax: event.target.value });
                        }}
                      />
                    </label>
                  </div>
                </fieldset>
                <label className={`${styles.field} mb-6`}>
                  Minimum TMDB rating
                  <span className={styles.muted}>Out of 10</span>
                  <select
                    className={styles.input}
                    value={draft.ratingMin}
                    onChange={(event) => {
                      setValidation(null);
                      setDraft({ ...draft, ratingMin: event.target.value });
                    }}
                  >
                    <option value="">Any rating</option>
                    {draft.ratingMin &&
                      !Number.isInteger(Number(draft.ratingMin)) && (
                        <option value={draft.ratingMin}>
                          {draft.ratingMin}+ / 10
                        </option>
                      )}
                    {Array.from({ length: 11 }, (_, rating) => (
                      <option key={rating} value={rating}>
                        {rating}+ / 10
                      </option>
                    ))}
                  </select>
                </label>
                <details className={styles.more}>
                  <summary>More options</summary>
                  <fieldset className={`${styles.group} ${styles.countries}`}>
                    <legend>Country of origin</legend>
                    <label className={styles.field}>
                      Find a country
                      <input
                        type="search"
                        className={styles.input}
                        placeholder="Country name or code"
                        value={countrySearch}
                        onChange={(event) =>
                          setCountrySearch(event.target.value)
                        }
                      />
                    </label>
                    <div className={styles.options}>
                      {shownCountries.map((country) => (
                        <label className={styles.option} key={country.code}>
                          <input
                            type="checkbox"
                            checked={draft.countries.includes(country.code)}
                            onChange={() => toggle("countries", country.code)}
                          />
                          <span>{country.name}</span>
                        </label>
                      ))}
                    </div>
                    {!shownCountries.length && (
                      <p className={styles.muted}>
                        No countries match that name.
                      </p>
                    )}
                  </fieldset>
                  <label className={styles.field}>
                    Maximum rating
                    <select
                      className={styles.input}
                      value={draft.ratingMax}
                      onChange={(event) => {
                        setValidation(null);
                        setDraft({ ...draft, ratingMax: event.target.value });
                      }}
                    >
                      <option value="">No maximum</option>
                      {draft.ratingMax &&
                        !Number.isInteger(Number(draft.ratingMax)) && (
                          <option value={draft.ratingMax}>
                            {draft.ratingMax} / 10
                          </option>
                        )}
                      {Array.from({ length: 11 }, (_, rating) => (
                        <option key={rating} value={rating}>
                          {rating} / 10
                        </option>
                      ))}
                    </select>
                  </label>
                </details>
              </>
            )}
            <label className={styles.option}>
              <input
                type="checkbox"
                checked={draft.adult}
                onChange={(event) =>
                  setDraft({ ...draft, adult: event.target.checked })
                }
              />
              <span>Include adult titles</span>
            </label>
          </div>
          <footer className={styles.drawerFooter}>
            {validation && (
              <p role="alert" className={styles.error}>
                {validation}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={control}
                onClick={() => {
                  setDraft({
                    ...emptyFilters(),
                    type: applied.type,
                    sort: applied.sort,
                  });
                  setValidation(null);
                }}
              >
                Clear selections
              </button>
              <button type="submit" className={`${control} ${styles.primary}`}>
                Apply filters
              </button>
            </div>
          </footer>
        </form>
      </dialog>
    </main>
  );
}
