"use client";

import { useCallback, useMemo, useState } from "react";
import {
  toggleWatchlist,
  type WatchType,
} from "@/utils/watchlistClient";
import { useAuth } from "@/app/context/AuthProvider";
import { handleAppError } from "@/lib/errors";
import { appToast, TOAST_IDS } from "@/lib/toast";

type ToastMeta = {
  title?: string | null;
  posterUrl?: string | null;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
};

export function useWatchlist() {
  const { isAuthenticated, watchlist } = useAuth();
  const [error, setError] = useState("");

  const isInWatchlist = useCallback(
    (tmdbId: string | number, type: WatchType) => {
      const id = String(tmdbId);
      return type === "movie"
        ? watchlist.movieIds.has(id)
        : watchlist.seriesIds.has(id);
    },
    [watchlist.movieIds, watchlist.seriesIds],
  );

  const add = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        appToast.warning("Sign in to save this to your watchlist.", {
          id: "watchlist-auth-required",
          title: "Sign in needed",
        });
        return;
      }

      const id = String(tmdbId);
      setError("");
      watchlist.setItem(type, id, true);

      try {
        const res = await toggleWatchlist(id, type);
        if (res.removed) {
          watchlist.setItem(type, id, false);
          return;
        }

        appToast[meta?.variant ?? "success"]("Added to your watchlist.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3500,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e: unknown) {
        watchlist.setItem(type, id, false);
        const appError = handleAppError(e, {
          fallbackMessage: "Could not update your watchlist. Please try again.",
          toastTitle: "Watchlist",
          toastKey: TOAST_IDS.watchlistUpdateError,
        });
        setError(appError.userMessage);
        throw e;
      }
    },
    [isAuthenticated, watchlist],
  );

  const remove = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        appToast.warning("Sign in to save this to your watchlist.", {
          id: "watchlist-auth-required",
          title: "Sign in needed",
        });
        return;
      }

      const id = String(tmdbId);
      setError("");
      watchlist.setItem(type, id, false);

      try {
        const res = await toggleWatchlist(id, type);
        if (!res.removed) {
          watchlist.setItem(type, id, true);
          return;
        }

        appToast[meta?.variant ?? "info"]("Removed from your watchlist.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3500,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e: unknown) {
        watchlist.setItem(type, id, true);
        const appError = handleAppError(e, {
          fallbackMessage: "Could not update your watchlist. Please try again.",
          toastTitle: "Watchlist",
          toastKey: TOAST_IDS.watchlistUpdateError,
        });
        setError(appError.userMessage);
        throw e;
      }
    },
    [isAuthenticated, watchlist],
  );

  return {
    loading: watchlist.loading,
    ready: watchlist.ready,
    error,
    movieCount: useMemo(() => watchlist.movieIds.size, [watchlist.movieIds]),
    seriesCount: useMemo(() => watchlist.seriesIds.size, [watchlist.seriesIds]),
    refresh: watchlist.refresh,
    isInWatchlist,
    add,
    remove,
  };
}
