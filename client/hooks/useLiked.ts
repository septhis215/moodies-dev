"use client";

import { useCallback } from "react";
import { toggleLiked, type LikeType } from "@/utils/likedClient";
import { useAuth } from "@/app/context/AuthProvider";
import { useToast } from "@/app/context/ToastContext";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

export function useLiked() {
  const { toast } = useToast();
  const { isAuthenticated, liked } = useAuth();

  const isLiked = useCallback(
    (tmdbId: string | number, type: LikeType) => {
      const id = String(tmdbId);
      return type === "movie"
        ? liked.movieIds.has(id)
        : liked.seriesIds.has(id);
    },
    [liked.movieIds, liked.seriesIds],
  );

  const like = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Likes", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);
      liked.setItem(type, id, true);

      try {
        const res = await toggleLiked(id, type);
        if (!res.liked) {
          liked.setItem(type, id, false);
          return;
        }

        toast(
          "Added to your likes",
          meta?.variant ?? "success",
          meta?.duration ?? 3000,
          meta?.title ?? null,
          meta?.posterUrl ?? null,
        );
      } catch (e) {
        liked.setItem(type, id, false);
        console.error("[useLiked] like error:", e);
      }
    },
    [isAuthenticated, liked, toast],
  );

  const unlike = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Likes", "warning", 3500, null, null);
        return;
      }

      const id = String(tmdbId);
      liked.setItem(type, id, false);

      try {
        const res = await toggleLiked(id, type);
        if (res.liked) {
          liked.setItem(type, id, true);
          return;
        }

        toast(
          "Removed from your likes",
          meta?.variant ?? "info",
          meta?.duration ?? 3000,
          meta?.title ?? null,
          meta?.posterUrl ?? null,
        );
      } catch (e) {
        liked.setItem(type, id, true);
        console.error("[useLiked] unlike error:", e);
      }
    },
    [isAuthenticated, liked, toast],
  );

  return {
    isLiked,
    like,
    unlike,
    loading: liked.loading,
    ready: liked.ready,
    refresh: liked.refresh,
  };
}
