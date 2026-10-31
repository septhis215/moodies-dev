"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMediaStatsBatch,
  type MediaStatType,
  type EngagementStat,
  type StatsMap,
  ZERO_STAT,
  MEDIA_STATS_CHANGED,
} from "@/utils/mediaStatsClient";

export { ZERO_STAT };

export function useMediaStats(
  items: Array<{ id: number; type: MediaStatType }>,
) {
  const [stats, setStats] = useState<StatsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const key = items.map((item) => `${item.id}:${item.type}`).join(',');

  useEffect(() => {
    window.addEventListener(MEDIA_STATS_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(MEDIA_STATS_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const requested = key ? key.split(',').map((item) => {
      const [id, type] = item.split(':');
      return { id: Number(id), type: type as MediaStatType };
    }) : [];
    setLoading(Boolean(requested.length));
    setError(false);
    if (!requested.length) return;
    fetchMediaStatsBatch(requested)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, revision]);

  const getStat = useCallback(
    (id: number, type: MediaStatType): EngagementStat =>
      stats[`${id}:${type}`] ?? ZERO_STAT,
    [stats],
  );

  return { stats, getStat, loading, error, refresh };
}
