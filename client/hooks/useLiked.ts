"use client";

import { useCallback } from "react";
import { toggleLiked, type LikeType } from "@/utils/likedClient";
import { useAuth } from "@/app/context/AuthProvider";
import { handleAppError } from "@/lib/errors";
import { appToast, TOAST_IDS } from "@/lib/toast";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

export function useLiked() {
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
        appToast.warning("Sign in to save favorites.", {
          id: "favorites-auth-required",
          title: "Sign in needed",
        });
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

        appToast[meta?.variant ?? "success"]("Added to favorites.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3000,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e) {
        liked.setItem(type, id, false);
        handleAppError(e, {
          fallbackMessage: "Could not update favorites. Please try again.",
          toastTitle: "Likes",
          toastKey: TOAST_IDS.favoriteUpdateError,
        });
      }
    },
    [isAuthenticated, liked],
  );

  const unlike = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        appToast.warning("Sign in to save favorites.", {
          id: "favorites-auth-required",
          title: "Sign in needed",
        });
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

        appToast[meta?.variant ?? "info"]("Removed from favorites.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3000,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e) {
        liked.setItem(type, id, true);
        handleAppError(e, {
          fallbackMessage: "Could not update favorites. Please try again.",
          toastTitle: "Likes",
          toastKey: TOAST_IDS.favoriteUpdateError,
        });
      }
    },
    [isAuthenticated, liked],
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
