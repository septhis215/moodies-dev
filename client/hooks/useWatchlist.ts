"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchWatchlist,
  toggleWatchlist,
  type WatchType,
} from "@/utils/watchlistClient";
import { useToast } from "@/app/context/ToastContext";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

export function useWatchlist() {
  // local sets for fast lookup
  const [movieIds, setMovieIds] = useState<Set<string>>(new Set());
  const [seriesIds, setSeriesIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false); // true after first load
  const [error, setError] = useState<string>("");

  const { toast } = useToast(); // use toast hook

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

  // add / remove now accept optional meta so callers can provide title/poster
  const add = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
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
        } else {
          // Success -> show toast (pass title/poster if provided)
          toast(
            "Added to your watchlist",
            meta?.variant ?? "info",
            meta?.duration ?? 3500,
            meta?.title ?? null,
            meta?.posterUrl ?? null
          );
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
          // replaced alert with toast
          toast("Please log in to use Watchlist", "warning", 3500, null, null);
          return;
        }
        console.error("[useWatchlist] add error:", e);
        throw e;
      }
    },
    [toast]
  );

  const remove = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
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
        } else {
          // Success -> show toast
          toast(
            "Removed from your watchlist",
            meta?.variant ?? "info",
            meta?.duration ?? 3500,
            meta?.title ?? null,
            meta?.posterUrl ?? null
          );
        }
      } catch (e: any) {
        // rollback on error
        if (type === "movie") setMovieIds((s) => new Set(s).add(id));
        else setSeriesIds((s) => new Set(s).add(id));

        if (String(e?.message || e).includes("NO_TOKEN")) {
          // replaced alert with toast
          toast("Please log in to use Watchlist", "warning", 3500, null, null);
          return;
        }
        console.error("[useWatchlist] remove error:", e);
        throw e;
      }
    },
    [toast]
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