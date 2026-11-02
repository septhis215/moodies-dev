"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthProvider";
import { achievementRequest, ACHIEVEMENTS_CHANGED } from "@/lib/achievements";
import type { AchievementState } from "@/types/achievements";

export default function useAchievements() {
  const { isAuthenticated, loading: sessionLoading, user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    userId: string;
    data: AchievementState | null;
    loading: boolean;
    error: boolean;
  } | null>(null);
  const backoff = useRef(0);
  const userId = isAuthenticated ? user?.id : undefined;
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setResult((previous) => ({
      userId,
      data: previous?.userId === userId ? previous.data : null,
      loading: true,
      error: false,
    }));
    void achievementRequest<AchievementState>("/me", {
      signal: controller.signal,
    })
      .then((data) => {
        if (
          !Array.isArray(data.achievements) ||
          !["ready", "disabled"].includes(data.status)
        )
          throw new Error("Invalid achievement state");
        if (!controller.signal.aborted)
          setResult({ userId, data, loading: false, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ userId, data: null, loading: false, error: true });
      });
    return () => controller.abort();
  }, [userId, attempt]);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener(ACHIEVEMENTS_CHANGED, update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(ACHIEVEMENTS_CHANGED, update);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);
  const current = result?.userId === userId ? result : null;
  useEffect(() => {
    if (!current?.data?.pending || !userId) {
      backoff.current = 0;
      return;
    }
    const timeout = window.setTimeout(
      () => {
        if (!document.hidden) refresh();
      },
      Math.min(30000, 3000 * 2 ** Math.min(backoff.current++, 3)),
    );
    return () => window.clearTimeout(timeout);
  }, [current?.data, userId, refresh]);
  return {
    data: current?.data || null,
    loading: sessionLoading || (!!userId && (!current || current.loading)),
    error: current?.error || false,
    authenticated: isAuthenticated,
    refresh,
  };
}
