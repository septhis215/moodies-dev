import { apiRequest } from "@/lib/errors/api-client";
export const ACHIEVEMENTS_CHANGED = "moodies:achievements-changed";
const base =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
export function achievementRequest<T>(path: string, init: RequestInit = {}) {
  return apiRequest<T>(`${base}/achievements${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init.headers },
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
}
export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
export async function recordAchievementActivity(
  activity: {
    kind: "visit" | "mood" | "detail";
    moodId?: string;
    tmdbId?: number;
    type?: "movie" | "tv";
  },
  signal?: AbortSignal,
) {
  await achievementRequest("/activity", {
    method: "POST",
    body: JSON.stringify({ ...activity, timezone: browserTimezone() }),
    signal,
  });
  window.dispatchEvent(new Event(ACHIEVEMENTS_CHANGED));
}
