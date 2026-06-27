"use client";

import { useCallback, useMemo, useState } from "react";
import {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useWatchlist() {
  const { toast } = useToast();
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
        toast("Please log in to use Watchlist", "warning", 3500, null, null);
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

        toast(
          "Added to your watchlist",
          meta?.variant ?? "info",
          meta?.duration ?? 3500,
          meta?.title ?? null,
          meta?.posterUrl ?? null,
        );
      } catch (e: unknown) {
        watchlist.setItem(type, id, false);

        if (getErrorMessage(e).includes("NO_TOKEN")) {
          toast("Please log in to use Watchlist", "warning", 3500, null, null);
          return;
        }

        setError(getErrorMessage(e) || "Failed to update watchlist");
        console.error("[useWatchlist] add error:", e);
        throw e;
      }
    },
    [isAuthenticated, toast, watchlist],
  );

  const remove = useCallback(
    async (tmdbId: string | number, type: WatchType, meta?: ToastMeta) => {
      if (!isAuthenticated) {
        toast("Please log in to use Watchlist", "warning", 3500, null, null);
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

        toast(
          "Removed from your watchlist",
          meta?.variant ?? "info",
          meta?.duration ?? 3500,
          meta?.title ?? null,
          meta?.posterUrl ?? null,
        );
      } catch (e: unknown) {
        watchlist.setItem(type, id, true);

        if (getErrorMessage(e).includes("NO_TOKEN")) {
          toast("Please log in to use Watchlist", "warning", 3500, null, null);
          return;
        }

        setError(getErrorMessage(e) || "Failed to update watchlist");
        console.error("[useWatchlist] remove error:", e);
        throw e;
      }
    },
    [isAuthenticated, toast, watchlist],
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
