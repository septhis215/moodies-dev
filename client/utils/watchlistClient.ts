const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type WatchType = "movie" | "series";

// Auth rides on the HttpOnly cookie now — every call sends credentials and no
// Bearer header. A 401 means "not signed in", which callers treat as empty.
export async function fetchWatchlist() {
  const r = await fetch(`${API_BASE}/watchlist`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  if (r.status === 401 || r.status === 498) return { movieId: [], seriesId: [] };
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function toggleWatchlist(tmdbId: string, type: "movie" | "series") {
  const r = await fetch(`${API_BASE}/watchlist/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tmdbId, type }),
  });
  if (r.status === 401 || r.status === 498) throw new Error("NO_TOKEN");
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<{ removed: boolean }>;
}
