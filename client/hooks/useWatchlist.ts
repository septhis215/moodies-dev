"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        appToast.warning("Sign in to save this title.", {
          id: "watchlist-auth-required",
          action: { label: "Sign in", onClick: () => router.push("/auth/login") },
        });
        return;
      }

      const id = String(tmdbId);
      setError("");

      try {
        const res = await toggleWatchlist(id, type, true);
        watchlist.setItem(type, id, !res.removed);
        if (res.removed) {
          return;
        }

        appToast[meta?.variant ?? "success"]("Added to your watchlist.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3500,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e: unknown) {
        await watchlist.refresh().catch(() => undefined);
        const appError = handleAppError(e, {
          fallbackMessage: "Could not update your watchlist. Please try again.",
          toastTitle: "Watchlist",
          toastKey: TOAST_IDS.watchlistUpdateError,
        });
        setError(appError.userMessage);
        throw e;
      }
    },
    [isAuthenticated, watchlist, router],
  );

  const remove = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        appToast.warning("Sign in to update your watchlist.", {
          id: "watchlist-auth-required",
          action: { label: "Sign in", onClick: () => router.push("/auth/login") },
        });
        return;
      }

      const id = String(tmdbId);
      setError("");

      try {
        const res = await toggleWatchlist(id, type, false);
        watchlist.setItem(type, id, !res.removed);
        if (!res.removed) {
          return;
        }

        appToast[meta?.variant ?? "info"]("Removed from your watchlist.", {
          title: meta?.title ?? null,
          duration: meta?.duration ?? 3500,
          posterUrl: meta?.posterUrl ?? null,
        });
      } catch (e: unknown) {
        await watchlist.refresh().catch(() => undefined);
        const appError = handleAppError(e, {
          fallbackMessage: "Could not update your watchlist. Please try again.",
          toastTitle: "Watchlist",
          toastKey: TOAST_IDS.watchlistUpdateError,
        });
        setError(appError.userMessage);
        throw e;
      }
    },
    [isAuthenticated, watchlist, router],
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
