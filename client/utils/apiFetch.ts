"use client";
import { useAuth } from "@/app/context/AuthProvider";

export function useApiFetch() {
  const { refreshSession, logoutSilent } = useAuth();

  async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const headers = new Headers(init.headers as HeadersInit);
    headers.set("accept", "application/json");
    // Auth now rides on the HttpOnly cookie — send credentials, no Bearer header.
    const opts: RequestInit = {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
    };

    let res = await fetch(input, opts);

    if (res.status === 401 || res.status === 498) {
      // Access cookie likely expired — try one silent refresh, then retry once.
      const refreshed = await refreshSession();
      if (refreshed) {
        res = await fetch(input, opts);
      }
      if (res.status === 401 || res.status === 498) {
        logoutSilent();
      }
    }
    return res;
  }

  return { apiFetch };
}
