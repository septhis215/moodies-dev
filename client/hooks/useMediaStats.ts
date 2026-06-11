"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchMediaStatsBatch,
  type MediaStatType,
  type EngagementStat,
  type StatsMap,
  ZERO_STAT,
} from "@/utils/mediaStatsClient";

export { ZERO_STAT };

export function useMediaStats(
  items: Array<{ id: number; type: MediaStatType }>,
) {
  const [stats, setStats] = useState<StatsMap>({});
  const [loading, setLoading] = useState(false);

  // Stable key — only re-fetches when the item list actually changes
  const key = useMemo(
    () => items.map((i) => `${i.id}:${i.type}`).join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, items.map((i) => `${i.id}:${i.type}`).join(",")],
  );

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    setLoading(true);
    fetchMediaStatsBatch(items)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // key captures the full item list identity
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStat = useCallback(
    (id: number, type: MediaStatType): EngagementStat =>
      stats[`${id}:${type}`] ?? ZERO_STAT,
    [stats],
  );

  return { stats, getStat, loading };
}
