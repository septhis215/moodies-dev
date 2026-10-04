"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthProvider";
import { fetchMediaSummary, type MediaSummary } from "@/lib/mediaApi";
import { handleAppError } from "@/lib/errors";
import { appToast } from "@/lib/toast";
import { tmdbImage } from "@/lib/tmdb";
import {
  entryKey,
  entryTitle,
  restoreLibraryEntry,
  type LibraryEntry,
  type LibraryKind,
} from "./library-state";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api"
).replace(/\/$/, "");
type LibraryState = {
  scope: string;
  entries: LibraryEntry[];
  phase: "list" | "details" | "ready" | "error";
  completed: number;
};

export function useLibrary(kind: LibraryKind) {
  const auth = useAuth();
  const userId = auth.isAuthenticated ? auth.user?.id : undefined;
  const scope = userId ? userId + ":" + kind : "guest";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<LibraryState>({
    scope: "",
    entries: [],
    phase: "list",
    completed: 0,
  });
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const cache = useRef<{ scope: string; summaries: Map<string, MediaSummary> }>(
    { scope: "", summaries: new Map() },
  );
  const activeScope = useRef(scope);

  useEffect(() => {
    activeScope.current = scope;
    pending.current.clear();
    setBusy(new Set());
    if (auth.loading || !userId) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted;
    if (cache.current.scope !== scope)
      cache.current = { scope, summaries: new Map() };
    const summaries = cache.current.summaries;
    setState({ scope, entries: [], phase: "list", completed: 0 });

    void (async () => {
      try {
        const response = await fetch(API_BASE + "/" + kind, {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });
        if (!response.ok) throw new Error("Could not load library");
        const buckets = await response.json();
        if (!Array.isArray(buckets.movieId) || !Array.isArray(buckets.seriesId))
          throw new Error("Invalid library response");
        if (!current()) return;
        const entries: LibraryEntry[] = [];
        for (const [mediaKind, ids] of [
          ["movie", buckets.movieId],
          ["tv", buckets.seriesId],
        ] as const) {
          for (const rawId of ids) {
            const id = String(rawId);
            if (!/^\d+$/.test(id) || Number(id) <= 0) continue;
            const entry = {
              kind: mediaKind,
              id,
              order: entries.length,
              summary: summaries.get(mediaKind + ":" + id) ?? null,
            };
            if (!entries.some((item) => entryKey(item) === entryKey(entry)))
              entries.push(entry);
          }
        }
        setState({
          scope,
          entries,
          phase: entries.length ? "details" : "ready",
          completed: 0,
        });
        let next = 0;
        let completed = 0;
        await Promise.all(
          Array.from({ length: Math.min(5, entries.length) }, async () => {
            while (next < entries.length && current()) {
              const entry = entries[next++];
              const summary =
                entry.summary ??
                (await fetchMediaSummary(entry.kind, entry.id, {
                  signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(12_000),
                  ]),
                }));
              if (!current()) return;
              if (summary) summaries.set(entryKey(entry), summary);
              completed++;
              setState((previous) =>
                previous.scope !== scope
                  ? previous
                  : {
                      ...previous,
                      completed,
                      entries: previous.entries.map((item) =>
                        entryKey(item) === entryKey(entry)
                          ? { ...item, summary }
                          : item,
                      ),
                    },
              );
            }
          }),
        );
        if (current())
          setState((previous) => ({ ...previous, phase: "ready" }));
      } catch {
        if (current())
          setState({ scope, entries: [], phase: "error", completed: 0 });
      }
    })();
    return () => controller.abort();
  }, [auth.loading, userId, scope, kind, revision]);

  const remove = useCallback(
    async (entry: LibraryEntry) => {
      const key = entryKey(entry);
      const operation = scope + ":" + key;
      if (!userId || pending.current.has(operation)) return;
      pending.current.add(operation);
      setBusy((previous) => new Set(previous).add(key));
      const collection = kind === "watchlist" ? auth.watchlist : auth.liked;
      const hookKind = entry.kind === "tv" ? "series" : "movie";
      collection.setItem(hookKind, entry.id, false);
      setState((previous) => ({
        ...previous,
        entries: previous.entries.filter((item) => entryKey(item) !== key),
      }));
      try {
        const response = await fetch(
          API_BASE +
            "/" +
            kind +
            "/" +
            entry.kind +
            "/" +
            encodeURIComponent(entry.id),
          {
            method: "DELETE",
            credentials: "include",
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) throw new Error("Could not remove title");
        if (activeScope.current !== scope) return;
        appToast.info(
          kind === "watchlist"
            ? "Removed from your watchlist."
            : "Removed from your liked titles.",
          {
            title: entryTitle(entry),
            posterUrl: tmdbImage(entry.summary?.poster_path, "w154"),
            duration: 3500,
          },
        );
      } catch (error) {
        if (activeScope.current !== scope) return;
        collection.setItem(hookKind, entry.id, true);
        setState((previous) =>
          previous.scope !== scope
            ? previous
            : {
                ...previous,
                entries: restoreLibraryEntry(previous.entries, entry),
              },
        );
        handleAppError(error, {
          fallbackMessage: "Could not remove this title. Please try again.",
          toastTitle: kind === "watchlist" ? "Watchlist" : "Liked",
        });
      } finally {
        pending.current.delete(operation);
        if (activeScope.current === scope)
          setBusy((previous) => {
            const next = new Set(previous);
            next.delete(key);
            return next;
          });
      }
    },
    [auth.watchlist, auth.liked, kind, scope, userId],
  );

  return {
    entries: state.scope === scope ? state.entries : [],
    phase: state.scope === scope ? state.phase : "list",
    completed: state.completed,
    authLoading: auth.loading,
    signedIn: Boolean(userId),
    busy,
    remove,
    retry: () => setRevision((current) => current + 1),
  };
}
