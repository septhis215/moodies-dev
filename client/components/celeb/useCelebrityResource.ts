"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";

export default function useCelebrityResource<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: boolean;
    loading: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ path, data: null, error: false, loading: true });
    fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Celebrity content unavailable");
        const data = (await response.json()) as T;
        if (!controller.signal.aborted)
          setResult({ path, data, error: false, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ path, data: null, error: true, loading: false });
      });
    return () => controller.abort();
  }, [path, attempt]);
  const current = result?.path === path ? result : null;
  return {
    data: current?.data || null,
    error: current?.error || false,
    loading: current?.loading ?? true,
    retry: () => setAttempt((value) => value + 1),
  };
}
