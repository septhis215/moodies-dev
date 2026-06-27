"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppLoading from "@/components/ui/AppLoading";

/* ---------- Types ---------- */
type User = {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
  provider?: string;
};

type IdBuckets = {
  movieId: string[];
  seriesId: string[];
};

type AccountCollectionState = {
  movieIds: Set<string>;
  seriesIds: Set<string>;
  loading: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
  setItem: (type: "movie" | "series", id: string, active: boolean) => void;
};

type JsonRecord = Record<string, unknown>;
type ToastFn = (
  title: string,
  type: string,
  duration: number,
  label: string,
  image: string,
  size: { width: number; height: number },
) => void;

type AuthContextValue = {
  user: User | null; // null => guest
  isAuthenticated: boolean;
  loading: boolean; // true until the first /me check resolves
  watchlist: AccountCollectionState;
  liked: AccountCollectionState;
  /** Re-hydrate the user from the cookie session (after a login). */
  login: (user?: User) => Promise<void>;
  /** Explicit logout: revokes the refresh token server-side, then clears state. */
  logout: () => Promise<void>;
  /** Drop client state without a server round-trip (used on a hard 401). */
  logoutSilent: () => void;
  /** Attempt a single silent token refresh. Returns true on success. */
  refreshSession: () => Promise<boolean>;
  /** Re-fetch the current user from /auth/me. */
  reloadUser: () => Promise<void>;
};

/* ---------- Config ---------- */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const MOODIES_LOGO = "/images/moodies-transparent.png";
const MOODIES_SIZE = { width: 30, height: 30 };
const SESSION_MARKER_KEY = "moodies:session";
const SESSION_MARKER_COOKIE = "mood_session";
const SESSION_MARKER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const AUTH_PREHIDE_STYLE_ID = "moodies-auth-prehide";
const LAST_ACCOUNT_KEY = "moodies:last-account";
const WATCHLIST_CACHE_PREFIX = "moodies:watchlist:";
const LIKED_CACHE_PREFIX = "moodies:liked:";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Normalize /me into our User shape, handling common nestings. */
function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function extractUser(payload: unknown): User {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const p = asRecord(data.user ?? root.user ?? root.profile ?? root.data ?? root);
  const nestedUser = asRecord(p.user);
  const id =
    stringValue(p.id) ??
    stringValue(p.sub) ??
    stringValue(p.userId) ??
    stringValue(p.uid);
  const username =
    stringValue(p.username) ??
    stringValue(p.userName) ??
    stringValue(p.user_name) ??
    stringValue(p.login) ??
    stringValue(p.handle);
  const name =
    stringValue(p.name) ??
    stringValue(p.fullname) ??
    stringValue(p.full_name) ??
    username ??
    "User";
  const email = stringValue(p.email) ?? stringValue(p.mail) ?? stringValue(nestedUser.email);
  const avatarUrl =
    stringValue(p.avatarUrl) ?? stringValue(p.avatar_url) ?? stringValue(p.picture);
  const provider = stringValue(p.provider);
  return { id, name, username, email, avatarUrl, provider };
}

function hasSessionMarker(): boolean {
  if (typeof window === "undefined") return false;

  const hasStorageMarker =
    window.localStorage.getItem(SESSION_MARKER_KEY) === "1";
  const hasCookieMarker = document.cookie
    .split(";")
    .some((part) => part.trim() === `${SESSION_MARKER_COOKIE}=1`);

  return hasStorageMarker || hasCookieMarker;
}

function isGoogleLoginLanding(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("google_login") === "true"
  );
}

function shouldBlockForSessionBootstrap(): boolean {
  return hasSessionMarker() || isGoogleLoginLanding();
}

export function markSessionPresent(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_MARKER_KEY, "1");
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SESSION_MARKER_COOKIE}=1; path=/; max-age=${SESSION_MARKER_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  }
}

export function clearSessionMarker(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_MARKER_KEY);
    window.localStorage.removeItem(LAST_ACCOUNT_KEY);
    document.cookie = `${SESSION_MARKER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function getLastAccountId(): string | undefined {
  if (typeof window === "undefined" || !hasSessionMarker()) return undefined;
  return window.localStorage.getItem(LAST_ACCOUNT_KEY) ?? undefined;
}

function setLastAccountId(userId?: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(LAST_ACCOUNT_KEY, userId);
}

function toSet(values?: string[]) {
  return new Set(values ?? []);
}

function readCachedBuckets(prefix: string, userId?: string) {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${prefix}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IdBuckets>;
    return {
      movieIds: toSet(parsed.movieId),
      seriesIds: toSet(parsed.seriesId),
    };
  } catch {
    return null;
  }
}

function writeCachedBuckets(
  prefix: string,
  userId: string | undefined,
  movieIds: Set<string>,
  seriesIds: Set<string>,
) {
  if (!userId || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${prefix}${userId}`,
      JSON.stringify({
        movieId: Array.from(movieIds),
        seriesId: Array.from(seriesIds),
      }),
    );
  } catch {
    /* Ignore storage quota/private-mode failures. */
  }
}

/* ---------- Provider ---------- */
export function AuthProvider({
  children,
  initialBlockSessionBootstrap = false,
}: {
  children: React.ReactNode;
  initialBlockSessionBootstrap?: boolean;
}) {
  const initialAccountId = getLastAccountId();
  const initialWatchlist = readCachedBuckets(
    WATCHLIST_CACHE_PREFIX,
    initialAccountId,
  );
  const initialLiked = readCachedBuckets(LIKED_CACHE_PREFIX, initialAccountId);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockSessionBootstrap, setBlockSessionBootstrap] = useState(
    () => initialBlockSessionBootstrap || shouldBlockForSessionBootstrap(),
  );
  const [watchlistMovieIds, setWatchlistMovieIds] = useState<Set<string>>(
    () => initialWatchlist?.movieIds ?? new Set(),
  );
  const [watchlistSeriesIds, setWatchlistSeriesIds] = useState<Set<string>>(
    () => initialWatchlist?.seriesIds ?? new Set(),
  );
  const [watchlistLoading, setWatchlistLoading] = useState(!initialWatchlist);
  const [watchlistReady, setWatchlistReady] = useState(!!initialWatchlist);
  const [likedMovieIds, setLikedMovieIds] = useState<Set<string>>(
    () => initialLiked?.movieIds ?? new Set(),
  );
  const [likedSeriesIds, setLikedSeriesIds] = useState<Set<string>>(
    () => initialLiked?.seriesIds ?? new Set(),
  );
  const [likedLoading, setLikedLoading] = useState(!initialLiked);
  const [likedReady, setLikedReady] = useState(!!initialLiked);

  const userId = user?.id;

  const applyBuckets = useCallback(
    (nextUserId: string | undefined, watchlist?: IdBuckets | null, liked?: IdBuckets | null) => {
      if (watchlist) {
        const nextMovieIds = toSet(watchlist.movieId);
        const nextSeriesIds = toSet(watchlist.seriesId);
        setWatchlistMovieIds(nextMovieIds);
        setWatchlistSeriesIds(nextSeriesIds);
        setWatchlistLoading(false);
        setWatchlistReady(true);
        writeCachedBuckets(WATCHLIST_CACHE_PREFIX, nextUserId, nextMovieIds, nextSeriesIds);
      }

      if (liked) {
        const nextMovieIds = toSet(liked.movieId);
        const nextSeriesIds = toSet(liked.seriesId);
        setLikedMovieIds(nextMovieIds);
        setLikedSeriesIds(nextSeriesIds);
        setLikedLoading(false);
        setLikedReady(true);
        writeCachedBuckets(LIKED_CACHE_PREFIX, nextUserId, nextMovieIds, nextSeriesIds);
      }
    },
    [],
  );

  const clearAccountState = useCallback(() => {
    setWatchlistMovieIds(new Set());
    setWatchlistSeriesIds(new Set());
    setWatchlistLoading(false);
    setWatchlistReady(true);
    setLikedMovieIds(new Set());
    setLikedSeriesIds(new Set());
    setLikedLoading(false);
    setLikedReady(true);
  }, []);

  // Identity now lives in an HttpOnly cookie the JS can't read, so we always
  // ask the server who we are rather than decoding a token client-side.
  const reloadUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/bootstrap`, {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const raw = await res.json();
        const boot = asRecord(raw);
        const bootUser = boot.user ? extractUser(boot.user) : null;
        setUser(bootUser);

        if (bootUser?.id) {
          markSessionPresent();
          setLastAccountId(bootUser.id);
          applyBuckets(
            bootUser.id,
            boot.watchlist as IdBuckets | null,
            boot.liked as IdBuckets | null,
          );
        } else {
          clearSessionMarker();
          clearAccountState();
        }
      }
    } catch {
      /* network error — keep current state */
    }
  }, [applyBuckets, clearAccountState]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!hasSessionMarker()) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        markSessionPresent();
        return true;
      }
      clearSessionMarker();
      return false;
    } catch {
      return false;
    }
  }, []);

  const logoutSilent = useCallback(() => {
    setUser(null);
    clearSessionMarker();
    clearAccountState();
  }, [clearAccountState]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore — clear client state regardless */
    }
    setUser(null);
    clearSessionMarker();
    clearAccountState();
  }, [clearAccountState]);

  const login = useCallback(
    async (usr?: User) => {
      if (usr) {
        setUser(usr); // optimistic; server cookie is already set
        markSessionPresent();
        setLastAccountId(usr.id);
      }
      await reloadUser();
    },
    [reloadUser]
  );

  // Bootstrap the session from cookies on first load (with one refresh retry).
  useEffect(() => {
    let cancelled = false;

    const isGoogleLanding = isGoogleLoginLanding();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/bootstrap`, {
          credentials: "include",
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const raw = await res.json();
          const boot = asRecord(raw);
          const bootUser = boot.user ? extractUser(boot.user) : null;
          setUser(bootUser);

          if (bootUser?.id) {
            markSessionPresent();
            setLastAccountId(bootUser.id);
            applyBuckets(
              bootUser.id,
              boot.watchlist as IdBuckets | null,
              boot.liked as IdBuckets | null,
            );
          } else if (hasSessionMarker()) {
            const refreshed = await refreshSession();
            if (!cancelled && refreshed) await reloadUser();
            if (!cancelled && !refreshed) {
              setUser(null);
              clearSessionMarker();
              clearAccountState();
            }
          } else {
            setUser(null);
            clearSessionMarker();
            clearAccountState();
          }
        }
      } catch {
        if (!cancelled) {
          setWatchlistLoading(false);
          setWatchlistReady(true);
          setLikedLoading(false);
          setLikedReady(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBlockSessionBootstrap(false);
        }
      }

      // Google sign-in landing: strip the flag from the URL and toast.
      if (isGoogleLanding && typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
        const showToast = (window as Window & { showToast?: ToastFn }).showToast;
        if (typeof showToast === "function") {
          showToast(
            "Welcome back!",
            "success",
            3000,
            "User",
            MOODIES_LOGO,
            MOODIES_SIZE
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyBuckets, clearAccountState, refreshSession, reloadUser]);

  useEffect(() => {
    if (!blockSessionBootstrap || typeof document === "undefined") return;
    document.getElementById(AUTH_PREHIDE_STYLE_ID)?.remove();
  }, [blockSessionBootstrap]);

  const refreshWatchlist = useCallback(async () => {
    if (!userId) {
      setWatchlistLoading(false);
      setWatchlistReady(true);
      return;
    }

    setWatchlistLoading(true);
    try {
      const res = await fetch(`${API_BASE}/watchlist`, {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<IdBuckets>;
      applyBuckets(userId, {
        movieId: data.movieId ?? [],
        seriesId: data.seriesId ?? [],
      }, null);
    } finally {
      setWatchlistLoading(false);
      setWatchlistReady(true);
    }
  }, [applyBuckets, userId]);

  const refreshLiked = useCallback(async () => {
    if (!userId) {
      setLikedLoading(false);
      setLikedReady(true);
      return;
    }

    setLikedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/liked`, {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<IdBuckets>;
      applyBuckets(userId, null, {
        movieId: data.movieId ?? [],
        seriesId: data.seriesId ?? [],
      });
    } finally {
      setLikedLoading(false);
      setLikedReady(true);
    }
  }, [applyBuckets, userId]);

  const setWatchlistItem = useCallback(
    (type: "movie" | "series", id: string, active: boolean) => {
      if (type === "movie") {
        setWatchlistMovieIds((current) => {
          const next = new Set(current);
          if (active) next.add(id);
          else next.delete(id);
          writeCachedBuckets(WATCHLIST_CACHE_PREFIX, userId, next, watchlistSeriesIds);
          return next;
        });
      } else {
        setWatchlistSeriesIds((current) => {
          const next = new Set(current);
          if (active) next.add(id);
          else next.delete(id);
          writeCachedBuckets(WATCHLIST_CACHE_PREFIX, userId, watchlistMovieIds, next);
          return next;
        });
      }
      setWatchlistReady(true);
    },
    [userId, watchlistMovieIds, watchlistSeriesIds],
  );

  const setLikedItem = useCallback(
    (type: "movie" | "series", id: string, active: boolean) => {
      if (type === "movie") {
        setLikedMovieIds((current) => {
          const next = new Set(current);
          if (active) next.add(id);
          else next.delete(id);
          writeCachedBuckets(LIKED_CACHE_PREFIX, userId, next, likedSeriesIds);
          return next;
        });
      } else {
        setLikedSeriesIds((current) => {
          const next = new Set(current);
          if (active) next.add(id);
          else next.delete(id);
          writeCachedBuckets(LIKED_CACHE_PREFIX, userId, likedMovieIds, next);
          return next;
        });
      }
      setLikedReady(true);
    },
    [likedMovieIds, likedSeriesIds, userId],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      watchlist: {
        movieIds: watchlistMovieIds,
        seriesIds: watchlistSeriesIds,
        loading: watchlistLoading,
        ready: watchlistReady,
        refresh: refreshWatchlist,
        setItem: setWatchlistItem,
      },
      liked: {
        movieIds: likedMovieIds,
        seriesIds: likedSeriesIds,
        loading: likedLoading,
        ready: likedReady,
        refresh: refreshLiked,
        setItem: setLikedItem,
      },
      login,
      logout,
      logoutSilent,
      refreshSession,
      reloadUser,
    }),
    [
      user,
      loading,
      watchlistMovieIds,
      watchlistSeriesIds,
      watchlistLoading,
      watchlistReady,
      refreshWatchlist,
      setWatchlistItem,
      likedMovieIds,
      likedSeriesIds,
      likedLoading,
      likedReady,
      refreshLiked,
      setLikedItem,
      login,
      logout,
      logoutSilent,
      refreshSession,
      reloadUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {blockSessionBootstrap ? <AppLoading /> : children}
    </AuthContext.Provider>
  );
}

/* ---------- Hook ---------- */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
