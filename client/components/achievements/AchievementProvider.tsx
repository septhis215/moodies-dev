"use client";
import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthProvider";
import {
  achievementRequest,
  recordAchievementActivity,
  ACHIEVEMENTS_CHANGED,
} from "@/lib/achievements";
import { resolveBadgeMascot } from "@/lib/badge-mascots";
import { appToast } from "@/lib/toast";
import type { AchievementNotification } from "@/types/achievements";

export default function AchievementProvider() {
  const { isAuthenticated, loading, user } = useAuth();
  useEffect(() => {
    if (!isAuthenticated || loading || !user?.id) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let nextAt = Infinity;
    let activeUntil = 0;
    let lastVisit = 0;
    let busy = false;
    let disabled = false;
    function schedule(delay: number) {
      if (disabled || controller.signal.aborted || Date.now() + delay >= nextAt)
        return;
      if (timer) window.clearTimeout(timer);
      nextAt = Date.now() + delay;
      timer = window.setTimeout(() => {
        nextAt = Infinity;
        void poll();
      }, delay);
    }
    async function poll() {
      if (controller.signal.aborted) return;
      if (document.hidden || busy) {
        schedule(30000);
        return;
      }
      busy = true;
      try {
        const result = await achievementRequest<{
          enabled: boolean;
          token: string | null;
          notifications: AchievementNotification[];
        }>("/notifications/claim", {
          method: "POST",
          signal: controller.signal,
        });
        if (result.enabled === false) {
          disabled = true;
          return;
        }
        if (
          !controller.signal.aborted &&
          result.token &&
          Array.isArray(result.notifications)
        ) {
          for (const notification of result.notifications) {
            if (controller.signal.aborted) break;
            const mascot = resolveBadgeMascot(notification.title);
            const options = {
              id: `achievement:${notification.id}`,
              title:
                notification.action === "revoke"
                  ? notification.title
                  : `${notification.title} unlocked`,
              duration: 6000,
              ...(mascot
                ? {
                    posterUrl: `/images/badges/${mascot}.png`,
                    imageSize: { width: 72, height: 72 },
                  }
                : {}),
            };
            if (notification.action === "revoke")
              appToast.info(notification.description, options);
            else appToast.success(notification.description, options);
            await achievementRequest(
              `/notifications/${notification.id}/acknowledge`,
              {
                method: "POST",
                body: JSON.stringify({ token: result.token }),
                signal: controller.signal,
              },
            );
          }
          if (result.notifications.length)
            window.dispatchEvent(new Event(ACHIEVEMENTS_CHANGED));
        }
      } catch {
        /* Durable unread notifications remain available after a transient failure. */
      } finally {
        busy = false;
        schedule(Date.now() < activeUntil ? 3000 : 60000);
      }
    }
    function interact() {
      if (document.hidden || disabled) return;
      activeUntil = Date.now() + 12000;
      if (Date.now() - lastVisit > 60000) {
        lastVisit = Date.now();
        void recordAchievementActivity(
          { kind: "visit" },
          controller.signal,
        ).catch(() => {});
      }
      schedule(800);
    }
    function visible() {
      if (!document.hidden) schedule(1000);
    }
    window.addEventListener("pointerdown", interact, { passive: true });
    window.addEventListener("keydown", interact);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener(ACHIEVEMENTS_CHANGED, visible);
    schedule(1500);
    return () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("pointerdown", interact);
      window.removeEventListener("keydown", interact);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener(ACHIEVEMENTS_CHANGED, visible);
    };
  }, [isAuthenticated, loading, user?.id]);
  return null;
}
