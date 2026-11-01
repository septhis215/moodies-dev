"use client";
import { useEffect, useState } from "react";
import { Check, Eye, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import {
  achievementRequest,
  recordAchievementActivity,
  ACHIEVEMENTS_CHANGED,
} from "@/lib/achievements";

type Status = { enabled: boolean; watched: boolean };
export default function WatchedTitleButton({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}) {
  const { user, isAuthenticated } = useAuth();
  const [result, setResult] = useState<{ key: string; status: Status } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = `${user?.id}:${type}:${id}`;
  const current = result?.key === key ? result.status : null;
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const controller = new AbortController();
    let enabled = true;
    void achievementRequest<Status>(`/watched/${type}/${id}`, {
      signal: controller.signal,
    })
      .then((status) => {
        if (!controller.signal.aborted) {
          enabled = status.enabled;
          setResult({ key, status });
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    let timer: number | undefined;
    function track() {
      if (timer) window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(() => {
        if (enabled)
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
  }, [isAuthenticated, user?.id, type, id, key, attempt]);
  if (!isAuthenticated || (current && !current.enabled)) return null;
  async function toggle() {
    if (!current) {
      setFailed(false);
      setAttempt((value) => value + 1);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const status = await achievementRequest<Status>(
        `/watched/${type}/${id}`,
        { method: "PUT", body: JSON.stringify({ active: !current.watched }) },
      );
      setResult({ key, status });
      window.dispatchEvent(new Event(ACHIEVEMENTS_CHANGED));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || (!current && !failed)}
      aria-pressed={!!current?.watched}
      aria-busy={busy}
      aria-label={
        failed
          ? "Retry watched status"
          : current?.watched
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
      ) : current?.watched ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="sr-only sm:not-sr-only">
        {failed ? "Retry" : current?.watched ? "Watched" : "Mark watched"}
      </span>
    </button>
  );
}
