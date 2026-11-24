"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        appToast.warning("Sign in to add favorites.", {
          id: "favorites-auth-required",
          action: { label: "Sign in", onClick: () => router.push("/auth/login") },
        });
        return;
      }

      const id = String(tmdbId);

      try {
        const res = await toggleLiked(id, type, true);
        liked.setItem(type, id, res.liked);
        if (!res.liked) {
          return;
        }

        appToast[meta?.variant ?? "success"]("Added to favorites.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3000,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e) {
        await liked.refresh().catch(() => undefined);
        handleAppError(e, {
          fallbackMessage: "Could not update favorites. Please try again.",
          toastTitle: "Likes",
          toastKey: TOAST_IDS.favoriteUpdateError,
        });
      }
    },
    [isAuthenticated, liked, router],
  );

  const unlike = useCallback(
    async (tmdbId: string | number, type: LikeType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        appToast.warning("Sign in to update your favorites.", {
          id: "favorites-auth-required",
          action: { label: "Sign in", onClick: () => router.push("/auth/login") },
        });
        return;
      }

      const id = String(tmdbId);

      try {
        const res = await toggleLiked(id, type, false);
        liked.setItem(type, id, res.liked);
        if (res.liked) {
          return;
        }

        appToast[meta?.variant ?? "info"]("Removed from favorites.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3000,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e) {
        await liked.refresh().catch(() => undefined);
        handleAppError(e, {
          fallbackMessage: "Could not update favorites. Please try again.",
          toastTitle: "Likes",
          toastKey: TOAST_IDS.favoriteUpdateError,
        });
      }
    },
    [isAuthenticated, liked, router],
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
