"use client";

import { useEffect, useMemo, useState } from "react";

type Watchlist = { movieId: string[]; seriesId: string[] };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function WatchlistPage() {
  const [data, setData] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") || "" : "";

  const movies = useMemo(() => data?.movieId ?? [], [data]);
  const series = useMemo(() => data?.seriesId ?? [], [data]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");

      if (!token) {
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
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-6">
          <br />
          <br />
          <h1 className="text-3xl font-bold">Your Watchlist</h1>
          <p className="text-white/60 mt-1">
            Movies and series you’ve saved. (API: {API_BASE})
          </p>
        </header>

        {/* Status / Debug strip */}
        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <Badge label={`Token: ${token ? "present" : "missing"}`} ok={!!token} />
          <Badge label={`Loading: ${loading ? "yes" : "no"}`} ok={!loading} />
          <Badge label={`Movies: ${movies.length}`} ok />
          <Badge label={`Series: ${series.length}`} ok />
          {err ? <Badge label={`Error: ${err}`} ok={false} /> : null}
        </div>

        {/* Not logged in */}
        {!token && !loading && (
          <EmptyState
            title="Please log in"
            note="You need to log in to view your watchlist."
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="text-white/80">Loading your watchlist…</div>
        )}

        {/* Error */}
        {!loading && err && (
          <EmptyState
            title="Couldn’t load your watchlist"
            note={err}
          />
        )}

        {/* Empty */}
        {!loading && !err && token && movies.length === 0 && series.length === 0 && (
          <EmptyState
            title="Your watchlist is empty"
            note="Go add a movie or series using the Watchlist button."
          />
        )}

        {/* Content */}
        {!loading && !err && (movies.length > 0 || series.length > 0) && (
          <div className="space-y-10">
            {movies.length > 0 && (
              <Section title={`Movies (${movies.length})`}>
                <IdPills ids={movies} />
              </Section>
            )}
            {series.length > 0 && (
              <Section title={`Series (${series.length})`}>
                <IdPills ids={series} />
              </Section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------- small UI helpers ---------- */

function Badge({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        ok ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" : "bg-red-500/15 text-red-300 border-red-400/30"
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

function IdPills({ ids }: { ids: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <li key={id} className="px-3 py-1 rounded-lg bg-white/10 border border-white/10">
          TMDB #{id}
        </li>
      ))}
    </ul>
  );
}
