"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";

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
  params: Record<string, string> = {}
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
  worker: (t: T, idx: number) => Promise<R>
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

    // optimistic update
    const prev = { data, movieItems, tvItems } as const;
    setBusyIds((s) => [...s, `${kind}:${id}`]);

    if (kind === "movie") {
      setMovieItems((s) => s.filter((x) => x.id !== idNum));
      setData((s) =>
        s ? { ...s, movieId: s.movieId.filter((x) => x !== id) } : s
      );
    } else {
      setTvItems((s) => s.filter((x) => x.id !== idNum));
      setData((s) =>
        s ? { ...s, seriesId: s.seriesId.filter((x) => x !== id) } : s
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
        // rollback on failure
        throw new Error(`${res.status} ${res.statusText}`);
      }
    } catch (e) {
      // rollback UI
      setData(prev.data);
      setMovieItems(prev.movieItems);
      setTvItems(prev.tvItems);
      console.error("Remove failed:", e);
    } finally {
      setBusyIds((s) => s.filter((k) => k !== `${kind}:${id}`));
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-4xl font-black">Your Watchlist</h1>
          <p className="text-gray-400 text-sm font-medium mt-2">
            Movies and series you've saved.
          </p>
        </header>

        {/* Status / Debug strip */}
        <div className="mb-8 flex flex-wrap gap-2 text-xs">
          <Badge label={`Movies: ${movieIds.length}`} ok />
          <Badge label={`TV Series: ${tvIds.length}`} ok />
          {err ? <Badge label={`Error: ${err}`} ok={false} /> : null}
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
              note="Go add a movie or series using the Watchlist button."
            />
          )}

        {!loading && !err && (movieItems.length > 0 || tvItems.length > 0) && (
          <div className="space-y-14">
            {movieItems.length > 0 && (
              <Section title={`Movies (${movieItems.length})`}>
                <Grid>
                  {movieItems.map((m) => (
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

            {tvItems.length > 0 && (
              <Section title={`Series (${tvItems.length})`}>
                <Grid>
                  {tvItems.map((t) => (
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
      className={`rounded-full px-3 py-1 ${
        ok
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

          {/* Gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Rating Badge */}
          {item.vote_average && (
            <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ring-1 ring-white/10">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              {item.vote_average.toFixed(1)}
            </div>
          )}

          {/* Checkmark Badge - Already in Watchlist */}
          <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ring-1 ring-emerald-400/30">
            <span>✓</span>
            <span>Saved</span>
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
                  className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl ${
                    busy
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
