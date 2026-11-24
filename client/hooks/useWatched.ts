"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/app/context/AuthProvider";
import { sessionEpoch } from "@/lib/auth/session";
import { achievementRequest, ACHIEVEMENTS_CHANGED } from "@/lib/achievements";

type MediaType = "movie" | "tv";
type Status = { enabled: boolean; watched: boolean };
type Membership = { enabled: boolean; titles: { tmdbId: number; type: MediaType }[] };
type State = {
  account: string;
  ready: boolean;
  enabled: boolean;
  titles: Set<string>;
  busy: Set<string>;
  errors: Map<string, string>;
  error: string;
};
const empty: State = {
  account: "", ready: false, enabled: true,
  titles: new Set(), busy: new Set(), errors: new Map(), error: "",
};
let state = empty;
let controller = new AbortController();
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(next: State) {
  state = next;
  listeners.forEach(listener => listener());
}
function selectAccount(account: string) {
  if (state.account === account) return;
  controller.abort();
  controller = new AbortController();
  pending = null;
  publish({ ...empty, account });
}
function load(account: string, retry = false): Promise<void> {
  if (!account || state.account !== account || state.ready) return Promise.resolve();
  if (state.error && !retry) return Promise.resolve();
  if (pending) return pending;
  const signal = controller.signal;
  publish({ ...state, error: "" });
  const operation = achievementRequest<Membership>("/watched", { signal })
    .then(result => {
      if (signal.aborted || state.account !== account) return;
      publish({ ...state, ready: true, enabled: result.enabled, error: "",
        titles: new Set(result.titles.map(title => `${title.type}:${title.tmdbId}`)) });
    })
    .catch(() => {
      if (!signal.aborted && state.account === account)
        publish({ ...state, error: "Could not load watched status. Try again." });
    })
    .finally(() => { if (pending === operation) pending = null; });
  pending = operation;
  return operation;
}

async function toggle(account: string, id: number, type: MediaType) {
  if (!account || state.account !== account) return false;
  if (!state.ready) {
    await load(account, true);
    return false;
  }
  const key = `${type}:${id}`;
  if (!state.enabled || state.busy.has(key)) return false;
  const signal = controller.signal;
  const busy = new Set(state.busy).add(key);
  const errors = new Map(state.errors);
  errors.delete(key);
  const active = !state.titles.has(key);
  publish({ ...state, busy, errors });
  try {
    const status = await achievementRequest<Status>(`/watched/${type}/${id}`, {
      method: "PUT", body: JSON.stringify({ active }), signal,
    });
    if (signal.aborted || state.account !== account) return false;
    const titles = new Set(state.titles);
    if (status.watched) titles.add(key);
    else titles.delete(key);
    publish({ ...state, titles, enabled: status.enabled });
    window.dispatchEvent(new Event(ACHIEVEMENTS_CHANGED));
    return true;
  } catch (error) {
    if (signal.aborted || state.account !== account) return false;
    const errors = new Map(state.errors);
    errors.set(key, "Could not update watched status. Try again.");
    publish({ ...state, errors });
    throw error;
  } finally {
    if (!signal.aborted && state.account === account) {
      const busy = new Set(state.busy);
      busy.delete(key);
      publish({ ...state, busy });
    }
  }
}

/** One authenticated membership read shared by every poster and detail action. */
export function useWatched(id: number, type: MediaType) {
  const { user, isAuthenticated } = useAuth();
  const account = isAuthenticated && user?.id ? `${user.id}:${sessionEpoch()}` : "";
  const snapshot = useSyncExternalStore(subscribe,
    () => state.account === account ? state : empty, () => empty);
  useEffect(() => {
    selectAccount(account);
    void load(account);
  }, [account]);
  const key = `${type}:${id}`;
  return {
    watched: snapshot.titles.has(key),
    ready: !account || snapshot.ready,
    enabled: snapshot.enabled,
    busy: snapshot.busy.has(key),
    error: snapshot.errors.get(key) || snapshot.error,
    toggle: () => toggle(account, id, type),
    refresh: () => load(account, true),
  };
}
