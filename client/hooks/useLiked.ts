"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchLikedList, toggleLiked, type LikeType } from "@/utils/likedClient";
import { useAuth } from "@/app/context/AuthProvider";
import { useToast } from "@/app/context/ToastContext";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

type CachedLiked = {
  movieId?: string[];
  seriesId?: string[];
};

const LIKED_CACHE_PREFIX = "moodies:liked:";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readCachedLiked(userId?: string) {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${LIKED_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLiked;
    return {
      movieIds: new Set(parsed.movieId ?? []),
      seriesIds: new Set(parsed.seriesId ?? []),
    };
  } catch {
    return null;
  }
}

function writeCachedLiked(
  userId: string | undefined,
  movieIds: Set<string>,
  seriesIds: Set<string>,
) {
  if (!userId || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${LIKED_CACHE_PREFIX}${userId}`,
      JSON.stringify({
        movieId: Array.from(movieIds),
        seriesId: Array.from(seriesIds),
      }),
    );
  } catch {
    /* Ignore storage quota/private-mode failures. */
  }
}

export function useLiked() {
  const { toast } = useToast();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userId = user?.id;
  const initialCached = useMemo(() => readCachedLiked(userId), [userId]);

  const [movieIds, setMovieIds] = useState<Set<string>>(
    () => initialCached?.movieIds ?? new Set(),
  );
  const [seriesIds, setSeriesIds] = useState<Set<string>>(
    () => initialCached?.seriesIds ?? new Set(),
  );
  const [loading, setLoading] = useState(!initialCached);
  const [ready, setReady] = useState(!!initialCached);

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
      return;
    }

    const cached = readCachedLiked(userId);
    if (cached) {
      setMovieIds(cached.movieIds);
      setSeriesIds(cached.seriesIds);
      setReady(true);
    }

    setLoading(true);
    try {
      const list = await fetchLikedList();
      const nextMovieIds = new Set<string>(list.movieId ?? []);
      const nextSeriesIds = new Set<string>(list.seriesId ?? []);
      setMovieIds(nextMovieIds);
      setSeriesIds(nextSeriesIds);
      writeCachedLiked(userId, nextMovieIds, nextSeriesIds);
    } catch (e: unknown) {
      if (!getErrorMessage(e).includes("NO_TOKEN")) {
        console.error("[useLiked] refresh error:", e);
      }
      setMovieIds(new Set());
      setSeriesIds(new Set());
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [authLoading, isAuthenticated, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isLiked = useCallback(
    (tmdbId: string | number, type: LikeType) => {
      const id = String(tmdbId);
      return type === "movie" ? movieIds.has(id) : seriesIds.has(id);
    },
    [movieIds, seriesIds]
  );

  const like = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Likes", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);

      if (type === "movie")
        setMovieIds((s) => {
          const next = new Set(s).add(id);
          writeCachedLiked(userId, next, seriesIds);
          return next;
        });
      else
        setSeriesIds((s) => {
          const next = new Set(s).add(id);
          writeCachedLiked(userId, movieIds, next);
          return next;
        });

      try {
        const res = await toggleLiked(id, type);
        if (!res.liked) {
          // API toggled it off instead
          if (type === "movie")
            setMovieIds((s) => {
              const n = new Set(s);
              n.delete(id);
              writeCachedLiked(userId, n, seriesIds);
              return n;
            });
          else
            setSeriesIds((s) => {
              const n = new Set(s);
              n.delete(id);
              writeCachedLiked(userId, movieIds, n);
              return n;
            });
        } else {
          toast(
            "Added to your likes",
            meta?.variant ?? "success",
            meta?.duration ?? 3000,
            meta?.title ?? null,
            meta?.posterUrl ?? null
          );
        }
      } catch (e) {
        // rollback
        if (type === "movie")
          setMovieIds((s) => {
            const n = new Set(s);
            n.delete(id);
            writeCachedLiked(userId, n, seriesIds);
            return n;
          });
        else
          setSeriesIds((s) => {
            const n = new Set(s);
            n.delete(id);
            writeCachedLiked(userId, movieIds, n);
            return n;
          });
        console.error("[useLiked] like error:", e);
      }
    },
    [isAuthenticated, movieIds, seriesIds, toast, userId]
  );

  const unlike = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Likes", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);

      if (type === "movie")
        setMovieIds((s) => {
          const n = new Set(s);
          n.delete(id);
          writeCachedLiked(userId, n, seriesIds);
          return n;
        });
      else
        setSeriesIds((s) => {
          const n = new Set(s);
          n.delete(id);
          writeCachedLiked(userId, movieIds, n);
          return n;
        });

      try {
        await toggleLiked(id, type);
        toast(
          "Removed from your likes",
          meta?.variant ?? "info",
          meta?.duration ?? 3000,
          meta?.title ?? null,
          meta?.posterUrl ?? null
        );
      } catch (e) {
        // rollback
        if (type === "movie")
          setMovieIds((s) => {
            const next = new Set(s).add(id);
            writeCachedLiked(userId, next, seriesIds);
            return next;
          });
        else
          setSeriesIds((s) => {
            const next = new Set(s).add(id);
            writeCachedLiked(userId, movieIds, next);
            return next;
          });
        console.error("[useLiked] unlike error:", e);
      }
    },
    [isAuthenticated, movieIds, seriesIds, toast, userId]
  );

  return { isLiked, like, unlike, loading, ready, refresh };
}
