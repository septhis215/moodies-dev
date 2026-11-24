"use client";
import { useEffect } from "react";
import { Check, Eye, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import {
  recordAchievementActivity,
} from "@/lib/achievements";
import { useWatched } from "@/hooks/useWatched";

export default function WatchedTitleButton({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}) {
  const { user, isAuthenticated } = useAuth();
  const { watched, ready, enabled, busy, error, toggle, refresh } = useWatched(id, type);
  const failed = Boolean(error);
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !ready || !enabled) return;
    const controller = new AbortController();
    let timer: number | undefined;
    function track() {
      if (timer) window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(() => {
        void recordAchievementActivity(
            { kind: "detail", tmdbId: id, type },
            controller.signal,
          ).catch(() => {});
      }, 5000);
    }
    track();
    document.addEventListener("visibilitychange", track);
    return () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", track);
    };
  }, [isAuthenticated, user?.id, type, id, ready, enabled]);
  if (!isAuthenticated || (ready && !enabled)) return null;
  return (
    <button
      type="button"
      onClick={() => void (ready ? toggle() : refresh()).catch(() => undefined)}
      disabled={busy || (!ready && !failed)}
      aria-pressed={watched}
      aria-busy={busy}
      aria-label={
        failed
          ? "Retry watched status"
          : watched
            ? "Marked as watched"
            : "Mark as watched"
      }
      title={
        failed
          ? "Watched status couldn’t update. Try again."
          : "Self-reported watched status"
      }
      className="ui-secondary-action leading-none"
    >
      {failed ? (
        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : watched ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="sr-only sm:not-sr-only">
        {failed ? "Retry" : watched ? "Watched" : "Mark watched"}
      </span>
    </button>
  );
}
