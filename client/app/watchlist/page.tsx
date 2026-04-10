"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import { useToast } from "@/app/context/ToastContext";
import { RatingBadge } from "@/components/ui/rating-badge";

/* -------------------- Types -------------------- */
type Watchlist = { movieId: string[]; seriesId: string[] };
type Kind = "movie" | "tv";

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

/* -------------------- Page -------------------- */

export default function WatchlistPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [movieItems, setMovieItems] = useState<Item[]>([]);
  const [tvItems, setTvItems] = useState<Item[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]); // ids being removed

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("authToken") || ""
      : "";

  const movieIds = useMemo(() => data?.movieId ?? [], [data]);
  const tvIds = useMemo(() => data?.seriesId ?? [], [data]);
  const [search, setSearch] = useState("");

  const filteredMovies = useMemo(() => {
    if (!search.trim()) return movieItems;
    const q = search.toLowerCase();
    return movieItems.filter((m) =>
      (m.kind === "movie" ? m.title : m.name).toLowerCase().includes(q),
    );
  }, [movieItems, search]);

  const filteredTv = useMemo(() => {
    if (!search.trim()) return tvItems;
    const q = search.toLowerCase();
    return tvItems.filter((t) =>
      (t.kind === "movie" ? t.title : t.name).toLowerCase().includes(q),
    );
  }, [tvItems, search]);

  /* 1) Load raw watchlist (IDs) from your server */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");

      if (!token) {
        setData(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/watchlist`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
        }
        const json = (await res.json()) as Watchlist;
        if (!alive) return;
        setData(json);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load watchlist");
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

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
    if (!token) return;

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
      : null;

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
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json",
        },
      });

      // Fallback: toggle endpoint some backends use
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${API_BASE}/watchlist/toggle`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
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
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-12 py-16">
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

        {!token && !loading && (
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
          token &&
          movieIds.length === 0 &&
          tvIds.length === 0 && (
            <EmptyState
              title="Your watchlist is empty"
              note="Go add a movie or series using the My List button."
            />
          )}

        {!loading && !err && (movieItems.length > 0 || tvItems.length > 0) && (
          <div className="space-y-14">
            {/* No results */}
            {search.trim() &&
              filteredMovies.length === 0 &&
              filteredTv.length === 0 && (
                <div className="py-16 text-center text-white/30 text-sm">
                  No results for{" "}
                  <span className="text-white/60">"{search}"</span>
                </div>
              )}

            {filteredMovies.length > 0 && (
              <Section title={`Movies (${filteredMovies.length})`}>
                <Grid>
                  {filteredMovies.map((m) => (
                    <Card
                      key={`m-${m.id}`}
                      item={m}
                      busy={busyIds.includes(`movie:${m.id}`)}
                      onRemove={() => removeFromWatchlist("movie", m.id)}
                    />
                  ))}
                </Grid>
              </Section>
            )}

            {filteredTv.length > 0 && (
              <Section title={`Series (${filteredTv.length})`}>
                <Grid>
                  {filteredTv.map((t) => (
                    <Card
                      key={`t-${t.id}`}
                      item={t}
                      busy={busyIds.includes(`tv:${t.id}`)}
                      onRemove={() => removeFromWatchlist("tv", t.id)}
                    />
                  ))}
                </Grid>
              </Section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/* -------------------- Small UI helpers -------------------- */

function Badge({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${ok
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
        : "bg-red-500/15 text-red-300 border-red-400/30"
        } border text-xs font-medium`}
    >
      {label}
    </span>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
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
            src={imgUrl(posterPath) || "/coming-soon.png"}
            alt={title}
            fill
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
            <RatingBadge rating={item.vote_average} variant="minimal" size="sm" />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex justify-center">
                <button
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    onRemove?.();
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl ${busy
                    ? "bg-red-500/40 cursor-not-allowed"
                    : "bg-red-500/90 hover:bg-red-600"
                    }`}
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </div>
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
