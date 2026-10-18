"use client";
import { throwIfResponseError } from "@/lib/errors";
import { sessionFetch } from "@/lib/auth/session";

export function useApiFetch() {
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

    return sessionFetch(input, opts);
  }

  async function apiFetchJson<T>(
    input: RequestInfo | URL,
    init: RequestInit = {},
    fallbackMessage?: string,
  ): Promise<T> {
    const res = await apiFetch(input, init);
    await throwIfResponseError(res, fallbackMessage);
    return (await res.json()) as T;
  }

  return { apiFetch, apiFetchJson };
}
