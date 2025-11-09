"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchWatchlist,
  toggleWatchlist,
  type WatchType,
} from "@/utils/watchlistClient";

export function useWatchlist() {
  // local sets for fast lookup
  const [movieIds, setMovieIds] = useState<Set<string>>(new Set());
  const [seriesIds, setSeriesIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false); // true after first load
  const [error, setError] = useState<string>("");

  /** initial fetch */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const wl = await fetchWatchlist(); // token handled inside client
      if (!wl) {
        // Not logged in or no data yet
        setMovieIds(new Set());
        setSeriesIds(new Set());
      } else {
        setMovieIds(new Set(wl.movieId ?? []));
        setSeriesIds(new Set(wl.seriesId ?? []));
      }
    } catch (e: any) {
      // If client threw "NO_TOKEN", just treat as logged-out silently.
      if (!String(e?.message || e).includes("NO_TOKEN")) {
        setError(e?.message || "Failed to load watchlist");
        console.error("[useWatchlist] refresh error:", e);
      } else {
        setMovieIds(new Set());
        setSeriesIds(new Set());
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** helpers */
  const isInWatchlist = useCallback(
    (tmdbId: string | number, type: WatchType) => {
      const id = String(tmdbId);
      return type === "movie" ? movieIds.has(id) : seriesIds.has(id);
    },
    [movieIds, seriesIds]
  );

  const add = useCallback(
    async (tmdbId: string | number, type: WatchType) => {
      const id = String(tmdbId);

      // optimistic add
      if (type === "movie") setMovieIds((s) => new Set(s).add(id));
      else setSeriesIds((s) => new Set(s).add(id));

      try {
        const res = await toggleWatchlist(id, type); // token handled inside client
        // If API removed , flip back
        if (res.removed) {
          if (type === "movie")
            setMovieIds((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
          else
            setSeriesIds((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
        }
      } catch (e: any) {
        // rollback on error
        if (type === "movie")
          setMovieIds((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        else
          setSeriesIds((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });

        if (String(e?.message || e).includes("NO_TOKEN")) {
          alert("Please log in to use Watchlist");
          return;
        }
        console.error("[useWatchlist] add error:", e);
        throw e;
      }
    },
    []
  );

  const remove = useCallback(
    async (tmdbId: string | number, type: WatchType) => {
      const id = String(tmdbId);

      // optimistic remove
      if (type === "movie")
        setMovieIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      else
        setSeriesIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });

      try {
        const res = await toggleWatchlist(id, type);
        // If API says it added (toggle again), revert
        if (!res.removed) {
          if (type === "movie") setMovieIds((s) => new Set(s).add(id));
          else setSeriesIds((s) => new Set(s).add(id));
        }
      } catch (e: any) {
        // rollback on error
        if (type === "movie") setMovieIds((s) => new Set(s).add(id));
        else setSeriesIds((s) => new Set(s).add(id));

        if (String(e?.message || e).includes("NO_TOKEN")) {
          alert("Please log in to use Watchlist");
          return;
        }
        console.error("[useWatchlist] remove error:", e);
        throw e;
      }
    },
    []
  );

  return {
    /** state */
    loading,
    ready,
    error,
    movieCount: useMemo(() => movieIds.size, [movieIds]),
    seriesCount: useMemo(() => seriesIds.size, [seriesIds]),

    /** API */
    refresh,
    isInWatchlist,
    add,
    remove,
  };
}
