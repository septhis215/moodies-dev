"use client";

import { useEffect, useMemo, useState } from "react";

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
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";       // v3

/* -------------------- TMDB helpers -------------------- */
function tmdbUrl(kind: Kind, id: string | number, params: Record<string, string> = {}) {
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
    const res = await fetch(tmdbUrl(kind, id), { headers: tmdbHeaders, cache: "no-store" });
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
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
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
const imgUrl = (path?: string | null, size = "w342") =>
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
    typeof window !== "undefined" ? localStorage.getItem("authToken") || "" : "";

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
      setData((s) => (s ? { ...s, movieId: s.movieId.filter((x) => x !== id) } : s));
    } else {
      setTvItems((s) => s.filter((x) => x.id !== idNum));
      setData((s) => (s ? { ...s, seriesId: s.seriesId.filter((x) => x !== id) } : s));
    }

    try {
      // Primary: RESTful delete
      let res = await fetch(`${API_BASE}/watchlist/${kind}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
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
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-6">
          <br />
          <br />
          <h1 className="text-3xl font-bold">Your Watchlist</h1>
          <p className="text-white/60 mt-1">Movies and series you’ve saved.</p>
        </header>

        {/* Status / Debug strip */}
        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <Badge label={`Movies: ${movieIds.length}`} ok />
          <Badge label={`TV Series: ${tvIds.length}`} ok />
          {err ? <Badge label={`Error: ${err}`} ok={false} /> : null}
        </div>

        {!token && !loading && (
          <EmptyState title="Please log in" note="You need to log in to view your watchlist." />
        )}

        {loading && <div className="text-white/80">Loading your watchlist…</div>}

        {!loading && err && <EmptyState title="Couldn’t load your watchlist" note={err} />}

        {!loading && !err && token && movieIds.length === 0 && tvIds.length === 0 && (
          <EmptyState title="Your watchlist is empty" note="Go add a movie or series using the Watchlist button." />
        )}

        {!loading && !err && (movieItems.length > 0 || tvItems.length > 0) && (
          <div className="space-y-10">
            {movieItems.length > 0 && (
              <Section title={`Movies (${movieItems.length})`}>
                <Grid>
                  {movieItems.map((m) => (
                    <Card
                      key={`m-${m.id}`}
                      href={`/movie/${m.id}`}
                      image={imgUrl(m.poster_path)}
                      title={m.kind === "movie" ? m.title : m.name}
                      meta={yearOf(m.release_date)}
                      rating={m.vote_average}
                      overview={m.overview}
                      removable
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
                      href={`/tv/${t.id}`}
                      image={imgUrl(t.poster_path)}
                      title={t.name}
                      meta={yearOf(t.first_air_date)}
                      rating={t.vote_average}
                      overview={t.overview}
                      removable
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
      } border`}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{children}</div>;
}

function Card({
  href,
  image,
  title,
  meta,
  rating,
  overview,
  removable = false,
  busy = false,
  onRemove,
}: {
  href?: string;
  image: string | null;
  title: string;
  meta?: string;
  rating?: number;
  overview?: string;
  removable?: boolean;
  busy?: boolean;
  onRemove?: () => void;
}) {
  const body = (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
      {/* Remove button */}
      {removable && onRemove && (
        <button
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          title="Remove from watchlist"
          aria-label="Remove from watchlist"
          className={`absolute right-2 top-2 z-10 rounded-full px-2.5 py-1 text-xs border ${
            busy
              ? "cursor-not-allowed bg-red-500/20 border-red-400/30 text-red-300/60"
              : "bg-red-500/20 border-red-400/40 text-red-200 hover:bg-red-500/30"
          }`}
        >
          {busy ? "…" : "Remove"}
        </button>
      )}

      <div className="aspect-[2/3] w-full overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-white/40 text-sm">No image</div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold line-clamp-2">{title}</h3>
          {typeof rating === "number" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 border border-white/10">
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-xs text-white/60 mt-1">{meta || "—"}</p>
        {overview ? <p className="text-xs text-white/70 mt-2 line-clamp-3">{overview}</p> : null}
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block">
      {body}
    </a>
  ) : (
    body
  );
}
