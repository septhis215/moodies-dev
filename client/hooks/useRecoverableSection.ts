"use client";

import { useEffect, useState } from "react";
import { fetchSectionJson } from "@/lib/section-fetch";

/** A successful empty response is data; only a failed server request needs recovery. */
export function useRecoverableSection<T>(initialData: T | null, endpoint: string, decode: (payload: unknown) => T) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({
    data: initialData, loading: initialData === null, error: false,
  });

  useEffect(() => {
    if (initialData !== null && attempt === 0) {
      setState({ data: initialData, loading: false, error: false });
      return;
    }
    let active = true;
    let controller: AbortController | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setState({ data: null, loading: true, error: false });
    const load = async (retry: boolean) => {
      controller = new AbortController();
      try {
        const base = (process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api").replace(/\/$/, "");
        const data = decode(await fetchSectionJson(`${base}${endpoint}`, controller.signal));
        if (active) setState({ data, loading: false, error: false });
      } catch {
        if (!active) return;
        if (!retry) retryTimer = setTimeout(() => void load(true), 1000);
        else setState({ data: null, loading: false, error: true });
      }
    };
    void load(false);
    return () => {
      active = false;
      controller?.abort();
      clearTimeout(retryTimer);
    };
  }, [initialData, endpoint, decode, attempt]);

  return { ...state, retry: () => setAttempt(value => value + 1) };
}
