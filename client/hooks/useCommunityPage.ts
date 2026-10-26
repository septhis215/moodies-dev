"use client";

import { useEffect, useState } from "react";
import { communityError, communityFetch } from "@/lib/api/community";

export function useCommunityPage<T>(path: string | null, viewerId?: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setData(null);
    setError("");
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void communityFetch<T>(
      path,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      },
      Boolean(viewerId),
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(communityError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, viewerId, revision]);

  return {
    data,
    setData,
    loading,
    error,
    reload: () => setRevision((value) => value + 1),
  };
}
