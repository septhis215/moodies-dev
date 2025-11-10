"use client";
import { useAuth } from "@/app/context/AuthProvider";

export function useApiFetch() {
  const { token, logoutSilent } = useAuth();

  async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const headers = new Headers(init.headers as HeadersInit);
    headers.set("accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(input, { ...init, headers, cache: "no-store" });

    if (res.status === 401 || res.status === 498) {
      // token invalid/expired -> become guest quietly
      logoutSilent();
    }
    return res;
  }

  return { apiFetch };
}
