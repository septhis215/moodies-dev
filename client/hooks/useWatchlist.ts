"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchWatchlist,
  toggleWatchlist,
  type WatchType,
} from "@/utils/watchlistClient";
import { useAuth } from "@/app/context/AuthProvider";
import { useToast } from "@/app/context/ToastContext";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

type CachedWatchlist = {
  movieId?: string[];
  seriesId?: string[];
};

const WATCHLIST_CACHE_PREFIX = "moodies:watchlist:";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readCachedWatchlist(userId?: string) {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${WATCHLIST_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWatchlist;
    return {
      movieIds: new Set(parsed.movieId ?? []),
      seriesIds: new Set(parsed.seriesId ?? []),
    };
  } catch {
    return null;
  }
}

function writeCachedWatchlist(
  userId: string | undefined,
  movieIds: Set<string>,
  seriesIds: Set<string>,
) {
  if (!userId || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${WATCHLIST_CACHE_PREFIX}${userId}`,
      JSON.stringify({
        movieId: Array.from(movieIds),
        seriesId: Array.from(seriesIds),
      }),
    );
  } catch {
    /* Ignore storage quota/private-mode failures. */
  }
}

export function useWatchlist() {
  const { toast } = useToast(); // use toast hook
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userId = user?.id;
  const initialCached = useMemo(() => readCachedWatchlist(userId), [userId]);

  // local sets for fast lookup
  const [movieIds, setMovieIds] = useState<Set<string>>(
    () => initialCached?.movieIds ?? new Set(),
  );
  const [seriesIds, setSeriesIds] = useState<Set<string>>(
    () => initialCached?.seriesIds ?? new Set(),
  );

  const [loading, setLoading] = useState(!initialCached);
  const [ready, setReady] = useState(!!initialCached); // true after first load
  const [error, setError] = useState<string>("");

  /** initial fetch */
  const refresh = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      setReady(false);
      return;
    }

    if (!isAuthenticated) {
      setMovieIds(new Set());
      setSeriesIds(new Set());
      setLoading(false);
      setReady(true);
      setError("");
      return;
    }

    const cached = readCachedWatchlist(userId);
    if (cached) {
      setMovieIds(cached.movieIds);
      setSeriesIds(cached.seriesIds);
      setReady(true);
    }

    setLoading(true);
    setError("");

    try {
      const wl = await fetchWatchlist(); // token handled inside client
      if (!wl) {
        // Not logged in or no data yet
        setMovieIds(new Set());
        setSeriesIds(new Set());
      } else {
        const nextMovieIds = new Set<string>(wl.movieId ?? []);
        const nextSeriesIds = new Set<string>(wl.seriesId ?? []);
        setMovieIds(nextMovieIds);
        setSeriesIds(nextSeriesIds);
        writeCachedWatchlist(userId, nextMovieIds, nextSeriesIds);
      }
    } catch (e: unknown) {
      // If client threw "NO_TOKEN", just treat as logged-out silently.
      if (!getErrorMessage(e).includes("NO_TOKEN")) {
        setError(getErrorMessage(e) || "Failed to load watchlist");
        console.error("[useWatchlist] refresh error:", e);
      } else {
        setMovieIds(new Set());
        setSeriesIds(new Set());
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [authLoading, isAuthenticated, userId]);

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
      if (!isAuthenticated) {
        toast("Please log in to use Watchlist", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);

      // optimistic add
      if (type === "movie")
        setMovieIds((s) => {
          const next = new Set(s).add(id);
          writeCachedWatchlist(userId, next, seriesIds);
          return next;
        });
      else
        setSeriesIds((s) => {
          const next = new Set(s).add(id);
          writeCachedWatchlist(userId, movieIds, next);
          return next;
        });

      try {
        const res = await toggleWatchlist(id, type); // token handled inside client
        // If API removed , flip back
        if (res.removed) {
          if (type === "movie")
            setMovieIds((s) => {
              const n = new Set(s);
              n.delete(id);
              writeCachedWatchlist(userId, n, seriesIds);
              return n;
            });
          else
            setSeriesIds((s) => {
              const n = new Set(s);
              n.delete(id);
              writeCachedWatchlist(userId, movieIds, n);
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
      } catch (e: unknown) {
        // rollback on error
        if (type === "movie")
          setMovieIds((s) => {
            const n = new Set(s);
            n.delete(id);
            writeCachedWatchlist(userId, n, seriesIds);
            return n;
          });
        else
          setSeriesIds((s) => {
            const n = new Set(s);
            n.delete(id);
            writeCachedWatchlist(userId, movieIds, n);
            return n;
          });

        if (getErrorMessage(e).includes("NO_TOKEN")) {
          // replaced alert with toast
          toast("Please log in to use Watchlist", "warning", 3500, null, null);
          return;
        }
        console.error("[useWatchlist] add error:", e);
        throw e;
      }
    },
    [isAuthenticated, movieIds, seriesIds, toast, userId]
  );

  const remove = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Watchlist", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);

      // optimistic remove
      if (type === "movie")
        setMovieIds((s) => {
          const n = new Set(s);
          n.delete(id);
          writeCachedWatchlist(userId, n, seriesIds);
          return n;
        });
      else
        setSeriesIds((s) => {
          const n = new Set(s);
          n.delete(id);
          writeCachedWatchlist(userId, movieIds, n);
          return n;
        });

      try {
        const res = await toggleWatchlist(id, type);
        // If API says it added (toggle again), revert
        if (!res.removed) {
          if (type === "movie")
            setMovieIds((s) => {
              const next = new Set(s).add(id);
              writeCachedWatchlist(userId, next, seriesIds);
              return next;
            });
          else
            setSeriesIds((s) => {
              const next = new Set(s).add(id);
              writeCachedWatchlist(userId, movieIds, next);
              return next;
            });
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
      } catch (e: unknown) {
        // rollback on error
        if (type === "movie")
          setMovieIds((s) => {
            const next = new Set(s).add(id);
            writeCachedWatchlist(userId, next, seriesIds);
            return next;
          });
        else
          setSeriesIds((s) => {
            const next = new Set(s).add(id);
            writeCachedWatchlist(userId, movieIds, next);
            return next;
          });

        if (getErrorMessage(e).includes("NO_TOKEN")) {
          // replaced alert with toast
          toast("Please log in to use Watchlist", "warning", 3500, null, null);
          return;
        }
        console.error("[useWatchlist] remove error:", e);
        throw e;
      }
    },
    [isAuthenticated, movieIds, seriesIds, toast, userId]
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
