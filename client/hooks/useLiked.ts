"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLikedList, toggleLiked, type LikeType } from "@/utils/likedClient";
import { useAuth } from "@/app/context/AuthProvider";
import { useToast } from "@/app/context/ToastContext";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useLiked() {
  const [movieIds, setMovieIds] = useState<Set<string>>(new Set());
  const [seriesIds, setSeriesIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const { toast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth();

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

    setLoading(true);
    try {
      const list = await fetchLikedList();
      setMovieIds(new Set(list.movieId ?? []));
      setSeriesIds(new Set(list.seriesId ?? []));
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
  }, [authLoading, isAuthenticated]);

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

      if (type === "movie") setMovieIds((s) => new Set(s).add(id));
      else setSeriesIds((s) => new Set(s).add(id));

      try {
        const res = await toggleLiked(id, type);
        if (!res.liked) {
          // API toggled it off instead
          if (type === "movie") setMovieIds((s) => { const n = new Set(s); n.delete(id); return n; });
          else setSeriesIds((s) => { const n = new Set(s); n.delete(id); return n; });
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
        if (type === "movie") setMovieIds((s) => { const n = new Set(s); n.delete(id); return n; });
        else setSeriesIds((s) => { const n = new Set(s); n.delete(id); return n; });
        console.error("[useLiked] like error:", e);
      }
    },
    [isAuthenticated, toast]
  );

  const unlike = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Likes", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);

      if (type === "movie") setMovieIds((s) => { const n = new Set(s); n.delete(id); return n; });
      else setSeriesIds((s) => { const n = new Set(s); n.delete(id); return n; });

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
        if (type === "movie") setMovieIds((s) => new Set(s).add(id));
        else setSeriesIds((s) => new Set(s).add(id));
        console.error("[useLiked] unlike error:", e);
      }
    },
    [isAuthenticated, toast]
  );

  return { isLiked, like, unlike, loading, ready, refresh };
}
