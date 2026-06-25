"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/app/context/ToastContext";
import { RatingBadge } from "@/components/ui/rating-badge";
import { useAuth } from "@/app/context/AuthProvider";

/* -------------------- Types -------------------- */
type Watchlist = { movieId: string[]; seriesId: string[] };
type Kind = "movie" | "tv";
type SortKey = "date_desc" | "date_asc" | "rating_desc" | "rating_asc";

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string;
};

type TmdbTv = {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string;
};

type Item = ({ kind: "movie" } & TmdbMovie) | ({ kind: "tv" } & TmdbTv);

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/* -------------------- Config -------------------- */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TMDB_READ_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN || ""; // v4
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || ""; // v3

/* -------------------- TMDB helpers -------------------- */
function tmdbUrl(
  kind: Kind,
  id: string | number,
  params: Record<string, string> = {},
) {
  const base =
    kind === "movie"
      ? `https://api.themoviedb.org/3/movie/${id}`
      : `https://api.themoviedb.org/3/tv/${id}`;

  const query = new URLSearchParams({ language: "en-US", ...params });
  if (!TMDB_READ_TOKEN && TMDB_API_KEY) query.set("api_key", TMDB_API_KEY);
  return `${base}?${query.toString()}`;
}

const tmdbHeaders: HeadersInit = TMDB_READ_TOKEN
  ? { accept: "application/json", Authorization: `Bearer ${TMDB_READ_TOKEN}` }
  : { accept: "application/json" };

async function fetchTmdb(kind: Kind, id: string): Promise<Item | null> {
  try {
    const res = await fetch(tmdbUrl(kind, id), {
      headers: tmdbHeaders,
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = await res.json();
    return { kind, ...json };
  } catch {
    return null;
  }
}

/* modest concurrency */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (t: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let i = 0;
  const runners = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
      }
    });
  await Promise.all(runners);
  return results;
}

/* formatting */
const yearOf = (d?: string) => (d && d.length >= 4 ? d.slice(0, 4) : "—");
const imgUrl = (path?: string | null, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

/* -------------------- Responsive page size -------------------- */

function usePageSize(): number {
  const [size, setSize] = useState(10);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w >= 1280) setSize(12);      // 6 cols × 2 rows
      else if (w >= 1024) setSize(10); // 5 cols × 2 rows
      else if (w >= 768) setSize(12);  // 4 cols × 3 rows
      else if (w >= 640) setSize(12);  // 3 cols × 4 rows
      else setSize(10);                // 2 cols × 5 rows
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/* -------------------- Page -------------------- */

export default function WatchlistPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [movieItems, setMovieItems] = useState<Item[]>([]);
  const [tvItems, setTvItems] = useState<Item[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]); // ids being removed

  const { isAuthenticated, loading: authLoading } = useAuth();

  const movieIds = useMemo(() => data?.movieId ?? [], [data]);
  const tvIds = useMemo(() => data?.seriesId ?? [], [data]);
  const [search, setSearch] = useState("");

  const pageSize = usePageSize();
  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);

  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [ratingMin, setRatingMin] = useState("");
  const [ratingMax, setRatingMax] = useState("");

  // Reset pagination when any filter/sort/search changes
  useEffect(() => {
    setMoviePage(1);
    setTvPage(1);
  }, [search, sortKey, yearMin, yearMax, ratingMin, ratingMax]);

  const filteredMovies = useMemo(() => {
    let list: Item[] = movieItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => (m.kind === "movie" ? m.title : m.name).toLowerCase().includes(q));
    }
    if (yearMin) {
      const yMin = parseInt(yearMin);
      list = list.filter((m) => {
        const d = m.kind === "movie" ? m.release_date : m.first_air_date;
        const y = d ? parseInt(d.slice(0, 4)) : null;
        return y === null || y >= yMin;
      });
    }
    if (yearMax) {
      const yMax = parseInt(yearMax);
      list = list.filter((m) => {
        const d = m.kind === "movie" ? m.release_date : m.first_air_date;
        const y = d ? parseInt(d.slice(0, 4)) : null;
        return y === null || y <= yMax;
      });
    }
    if (ratingMin) {
      const rMin = parseFloat(ratingMin);
      list = list.filter((m) => (m.vote_average ?? 0) >= rMin);
    }
    if (ratingMax) {
      const rMax = parseFloat(ratingMax);
      list = list.filter((m) => (m.vote_average ?? 0) <= rMax);
    }
    return [...list].sort((a, b) => {
      if (sortKey === "date_asc" || sortKey === "date_desc") {
        const aD = (a.kind === "movie" ? a.release_date : a.first_air_date) ?? "";
        const bD = (b.kind === "movie" ? b.release_date : b.first_air_date) ?? "";
        return sortKey === "date_asc" ? aD.localeCompare(bD) : bD.localeCompare(aD);
      }
      const aR = a.vote_average ?? 0;
      const bR = b.vote_average ?? 0;
      return sortKey === "rating_asc" ? aR - bR : bR - aR;
    });
  }, [movieItems, search, sortKey, yearMin, yearMax, ratingMin, ratingMax]);

  const filteredTv = useMemo(() => {
    let list: Item[] = tvItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => (t.kind === "movie" ? t.title : t.name).toLowerCase().includes(q));
    }
    if (yearMin) {
      const yMin = parseInt(yearMin);
      list = list.filter((t) => {
        const d = t.kind === "movie" ? t.release_date : t.first_air_date;
        const y = d ? parseInt(d.slice(0, 4)) : null;
        return y === null || y >= yMin;
      });
    }
    if (yearMax) {
      const yMax = parseInt(yearMax);
      list = list.filter((t) => {
        const d = t.kind === "movie" ? t.release_date : t.first_air_date;
        const y = d ? parseInt(d.slice(0, 4)) : null;
        return y === null || y <= yMax;
      });
    }
    if (ratingMin) {
      const rMin = parseFloat(ratingMin);
      list = list.filter((t) => (t.vote_average ?? 0) >= rMin);
    }
    if (ratingMax) {
      const rMax = parseFloat(ratingMax);
      list = list.filter((t) => (t.vote_average ?? 0) <= rMax);
    }
    return [...list].sort((a, b) => {
      if (sortKey === "date_asc" || sortKey === "date_desc") {
        const aD = (a.kind === "movie" ? a.release_date : a.first_air_date) ?? "";
        const bD = (b.kind === "movie" ? b.release_date : b.first_air_date) ?? "";
        return sortKey === "date_asc" ? aD.localeCompare(bD) : bD.localeCompare(aD);
      }
      const aR = a.vote_average ?? 0;
      const bR = b.vote_average ?? 0;
      return sortKey === "rating_asc" ? aR - bR : bR - aR;
    });
  }, [tvItems, search, sortKey, yearMin, yearMax, ratingMin, ratingMax]);

  /* 1) Load raw watchlist (IDs) from your server */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");

      if (authLoading) return; // wait for the session check
      if (!isAuthenticated) {
        setData(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/watchlist`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
        }
        const json = (await res.json()) as Watchlist;
        if (!alive) return;
        setData(json);
      } catch (e: unknown) {
        if (!alive) return;
        setErr(getErrorMessage(e, "Failed to load watchlist"));
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading]);

  /* 2) Fetch TMDB details for IDs */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!movieIds.length && !tvIds.length) {
        setMovieItems([]);
        setTvItems([]);
        return;
      }

      const [movies, tv] = await Promise.all([
        mapWithConcurrency(movieIds, 5, (id) => fetchTmdb("movie", id)),
        mapWithConcurrency(tvIds, 5, (id) => fetchTmdb("tv", id)),
      ]);

      if (!alive) return;

      setMovieItems(movies.filter(Boolean) as Item[]);
      setTvItems(tv.filter(Boolean) as Item[]);
    })();

    return () => {
      alive = false;
    };
  }, [movieIds, tvIds]);

  /* 3) Remove (server + optimistic UI) */
  async function removeFromWatchlist(kind: Kind, idNum: number) {
    const id = String(idNum);
    if (!isAuthenticated) return;

    // Find the item to get its details for the toast
    const item =
      kind === "movie"
        ? movieItems.find((m) => m.id === idNum)
        : tvItems.find((t) => t.id === idNum);

    const title = item
      ? kind === "movie"
        ? (item as TmdbMovie).title
        : (item as TmdbTv).name
      : "Item";

    const posterUrl = item?.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/placeholder-poster.svg";

    // optimistic update
    const prev = { data, movieItems, tvItems } as const;
    setBusyIds((s) => [...s, `${kind}:${id}`]);

    if (kind === "movie") {
      setMovieItems((s) => s.filter((x) => x.id !== idNum));
      setData((s) =>
        s ? { ...s, movieId: s.movieId.filter((x) => x !== id) } : s,
      );
    } else {
      setTvItems((s) => s.filter((x) => x.id !== idNum));
      setData((s) =>
        s ? { ...s, seriesId: s.seriesId.filter((x) => x !== id) } : s,
      );
    }

    try {
      // Primary: RESTful delete
      let res = await fetch(`${API_BASE}/watchlist/${kind}/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          accept: "application/json",
        },
      });

      // Fallback: toggle endpoint some backends use
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${API_BASE}/watchlist/toggle`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ kind, id: Number(id) }),
        });
      }

      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      // Show success toast with poster and title
      toast("Removed from your watchlist", "info", 3500, title, posterUrl);
    } catch (e) {
      // rollback UI
      setData(prev.data);
      setMovieItems(prev.movieItems);
      setTvItems(prev.tvItems);

      // Show error toast
      toast(
        `Couldn't remove ${title} from your watchlist. Please try again.`,
        "error",
        3500,
        null,
        null,
      );

      console.error("Remove failed:", e);
    } finally {
      setBusyIds((s) => s.filter((k) => k !== `${kind}:${id}`));
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-16 lg:px-12">
        {/* Header */}
        <div className="mt-10 mb-12 relative overflow-hidden">
          {/* Ghost watermark */}
          <span className="absolute -top-4 left-0 text-[5rem] sm:text-[8rem] font-black text-white/[0.03] leading-none select-none pointer-events-none tracking-tight whitespace-nowrap">
            MY LIST
          </span>

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            {/* Left */}
            <div>
              <div className="mb-2">
                <div className="w-8 h-0.5 bg-[rgb(233,79,55)] mb-2" />
                <span className="text-[0.62rem] font-bold tracking-[0.2em] uppercase text-white/30">
                  Your Collection
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
                My List
              </h1>
              <div className="flex items-center gap-2 mt-4">
                {movieIds.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[rgb(233,79,55)]" />
                    <span className="text-[0.7rem] text-white/40 font-medium">
                      {movieIds.length} Movie{movieIds.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {tvIds.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-[0.7rem] text-white/40 font-medium">
                      {tvIds.length} Series
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Search */}
            {(movieItems.length > 0 || tvItems.length > 0) && (
              <div className="relative w-full sm:w-64 flex-shrink-0">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search titles…"
                  className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 outline-none focus:border-[rgb(233,79,55)]/50 focus:bg-white/[0.06] transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Gradient rule */}
          <div className="mt-8 h-px bg-gradient-to-r from-[rgb(233,79,55)]/30 via-white/[0.06] to-transparent" />
        </div>

        {!isAuthenticated && !loading && (
          <EmptyState
            title="Please log in"
            note="You need to log in to view your watchlist."
          />
        )}

        {loading && (
          <div className="text-white/80">Loading your watchlist…</div>
        )}

        {!loading && err && (
          <EmptyState title="Couldn't load your watchlist" note={err} />
        )}

        {!loading &&
          !err &&
          isAuthenticated &&
          movieIds.length === 0 &&
          tvIds.length === 0 && (
            <EmptyState
              title="Your watchlist is empty"
              note="Go add a movie or series using the My List button."
            />
          )}

        {!loading && !err && (movieItems.length > 0 || tvItems.length > 0) && (
          <div className="space-y-14">
            <FilterBar
              sortKey={sortKey}
              onSort={setSortKey}
              yearMin={yearMin}
              yearMax={yearMax}
              ratingMin={ratingMin}
              ratingMax={ratingMax}
              onYearMin={setYearMin}
              onYearMax={setYearMax}
              onRatingMin={setRatingMin}
              onRatingMax={setRatingMax}
            />
            {/* No results */}
            {(search.trim() || yearMin || yearMax || ratingMin || ratingMax) &&
              filteredMovies.length === 0 &&
              filteredTv.length === 0 && (
                <div className="py-16 text-center text-white/30 text-sm">
                  No results for{" "}
                  <span className="text-white/60">&quot;{search}&quot;</span>
                </div>
              )}

            {filteredMovies.length > 0 && (
              <Section title={`Movies (${filteredMovies.length})`}>
                <Grid>
                  {filteredMovies.slice(0, pageSize * moviePage).map((m) => (
                    <Card
                      key={`m-${m.id}`}
                      item={m}
                      busy={busyIds.includes(`movie:${m.id}`)}
                      onRemove={() => removeFromWatchlist("movie", m.id)}
                    />
                  ))}
                </Grid>
                {filteredMovies.length > pageSize * moviePage && (
                  <ViewMore
                    count={Math.min(pageSize, filteredMovies.length - pageSize * moviePage)}
                    onClick={() => setMoviePage((p) => p + 1)}
                  />
                )}
              </Section>
            )}

            {filteredTv.length > 0 && (
              <Section title={`Series (${filteredTv.length})`}>
                <Grid>
                  {filteredTv.slice(0, pageSize * tvPage).map((t) => (
                    <Card
                      key={`t-${t.id}`}
                      item={t}
                      busy={busyIds.includes(`tv:${t.id}`)}
                      onRemove={() => removeFromWatchlist("tv", t.id)}
                    />
                  ))}
                </Grid>
                {filteredTv.length > pageSize * tvPage && (
                  <ViewMore
                    count={Math.min(pageSize, filteredTv.length - pageSize * tvPage)}
                    onClick={() => setTvPage((p) => p + 1)}
                  />
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/* -------------------- Small UI helpers -------------------- */

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date_desc", label: "Newest" },
  { key: "date_asc", label: "Oldest" },
  { key: "rating_desc", label: "Top Rated" },
  { key: "rating_asc", label: "Lowest Rated" },
];

function FilterBar({
  sortKey,
  onSort,
  yearMin,
  yearMax,
  ratingMin,
  ratingMax,
  onYearMin,
  onYearMax,
  onRatingMin,
  onRatingMax,
}: {
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  yearMin: string;
  yearMax: string;
  ratingMin: string;
  ratingMax: string;
  onYearMin: (v: string) => void;
  onYearMax: (v: string) => void;
  onRatingMin: (v: string) => void;
  onRatingMax: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActiveFilters = !!(yearMin || yearMax || ratingMin || ratingMax);

  return (
    <div className="space-y-2">
      {/* Row 1: sort label + horizontally scrollable pills + Filter button (sm+) */}
      <div className="flex items-center gap-2">
        <span className="text-[0.65rem] font-bold tracking-[0.18em] uppercase text-white/25 shrink-0">
          Sort
        </span>
        {/* Scrollable pill strip — hides scrollbar visually */}
        <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div className="flex items-center gap-2 w-max">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onSort(opt.key)}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${sortKey === opt.key
                    ? "bg-[rgb(233,79,55)]/15 border-[rgb(233,79,55)]/40 text-[rgb(233,79,55)]"
                    : "bg-transparent border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/[0.15]"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Filter button — only shown inline on sm+ */}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`hidden sm:flex shrink-0 items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${hasActiveFilters
              ? "bg-[rgb(233,79,55)]/15 border-[rgb(233,79,55)]/40 text-[rgb(233,79,55)]"
              : open
                ? "bg-white/[0.06] border-white/[0.15] text-white/60"
                : "bg-transparent border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/[0.15]"
            }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          Filter
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-[rgb(233,79,55)]" />
          )}
        </button>
      </div>

      {/* Row 2 (mobile only): full-width Filter button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`sm:hidden w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all font-medium ${hasActiveFilters
            ? "bg-[rgb(233,79,55)]/15 border-[rgb(233,79,55)]/40 text-[rgb(233,79,55)]"
            : open
              ? "bg-white/[0.06] border-white/[0.15] text-white/60"
              : "bg-transparent border-white/[0.08] text-white/40"
          }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
        {hasActiveFilters ? "Filters active" : "Filter"}
        {hasActiveFilters && (
          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(233,79,55)]" />
        )}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 sm:grid-cols-4 sm:gap-4 sm:p-4">
          <FilterInput
            label="Year from"
            value={yearMin}
            onChange={onYearMin}
            min="1900"
            max="2030"
            placeholder="e.g. 2000"
          />
          <FilterInput
            label="Year to"
            value={yearMax}
            onChange={onYearMax}
            min="1900"
            max="2030"
            placeholder="e.g. 2025"
          />
          <FilterInput
            label="Min rating"
            value={ratingMin}
            onChange={onRatingMin}
            min="0"
            max="10"
            step="0.5"
            placeholder="0 – 10"
          />
          <FilterInput
            label="Max rating"
            value={ratingMax}
            onChange={onRatingMax}
            min="0"
            max="10"
            step="0.5"
            placeholder="0 – 10"
          />
          {hasActiveFilters && (
            <div className="sm:col-span-4 flex justify-end pt-1">
              <button
                onClick={() => {
                  onYearMin("");
                  onYearMax("");
                  onRatingMin("");
                  onRatingMax("");
                }}
                className="text-xs text-white/30 hover:text-white/60 underline underline-offset-2 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  min,
  max,
  step = "1",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.65rem] font-bold tracking-wider uppercase text-white/25">
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

function ViewMore({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <div className="mt-8 flex justify-center">
      <button
        onClick={onClick}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/60 transition-all hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white/90 sm:px-6"
      >
        <span>View {count} more</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold mb-1">{title}</h2>
      {note ? <p className="text-white/70">{note}</p> : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-6 text-white">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {children}
    </div>
  );
}

function Card({
  item,
  busy = false,
  onRemove,
}: {
  item: Item;
  busy?: boolean;
  onRemove?: () => void;
}) {
  const title = item.kind === "movie" ? item.title : item.name;
  const releaseDate =
    item.kind === "movie" ? item.release_date : item.first_air_date;
  const posterPath = item.poster_path;
  const href = item.kind === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;

  return (
    <div className="group relative h-full">
      <Link href={href} className="block h-full">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 aspect-[2/3]">
          <Image
            src={imgUrl(posterPath) || "/placeholder-poster.svg"}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="group-hover:scale-110 transition-transform duration-700 object-cover"
          />

          {/* Saved bookmark */}
          <div className="absolute top-0 left-3 drop-shadow-lg">
            <svg
              width="26"
              height="36"
              viewBox="0 0 26 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Shadow layer */}
              <path
                d="M2 2H24V34L13 27L2 34V2Z"
                fill="rgba(0,0,0,0.3)"
                transform="translate(1, 1)"
              />
              {/* Main body */}
              <path d="M2 0H24V32L13 25L2 32V0Z" fill="rgb(233,79,55)" />
              {/* Shine highlight */}
              <path d="M2 0H13V32L2 32V0Z" fill="rgba(255,255,255,0.07)" />
              {/* Top edge highlight */}
              <path d="M2 0H24V2H2V0Z" fill="rgba(255,255,255,0.2)" />
              <path
                d="M13 9V17M9 13H17"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>
          </div>

          {/* Rating — bottom left, part of the natural gradient */}
          <div className="absolute top-2.5 right-2.5">
            <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <button
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  onRemove?.();
                }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${busy
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-white/[0.08] backdrop-blur-sm border border-white/[0.12] text-white/70 hover:bg-[rgb(233,79,55)]/20 hover:border-[rgb(233,79,55)]/40 hover:text-[rgb(233,79,55)]"
                  }`}
                title="Remove from watchlist"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                {busy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 px-1">
          <h4 className="font-bold text-sm sm:text-base line-clamp-2 group-hover:text-[#e94f37] transition-colors leading-tight text-white">
            {title}
          </h4>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
            {releaseDate && (
              <span className="font-semibold">{yearOf(releaseDate)}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
