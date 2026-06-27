"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(SESSION_MARKER_KEY) === "1"
  );
}

export function markSessionPresent(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_MARKER_KEY, "1");
  }
}

export function clearSessionMarker(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_MARKER_KEY);
  }
}

/* ---------- Provider ---------- */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Identity now lives in an HttpOnly cookie the JS can't read, so we always
  // ask the server who we are rather than decoding a token client-side.
  const reloadUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const raw = await res.json();
        setUser(raw ? extractUser(raw) : null);
        markSessionPresent();
      } else if (res.status === 401 || res.status === 498) {
        setUser(null);
        clearSessionMarker();
      }
    } catch {
      /* network error — keep current state */
    }
  }, []);

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
  }, []);

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
  }, []);

  const login = useCallback(
    async (usr?: User) => {
      if (usr) {
        setUser(usr); // optimistic; server cookie is already set
        markSessionPresent();
      }
      await reloadUser();
    },
    [reloadUser]
  );

  // Bootstrap the session from cookies on first load (with one refresh retry).
  useEffect(() => {
    let cancelled = false;

    const isGoogleLanding =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("google_login") === "true";

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const raw = await res.json();
          setUser(raw ? extractUser(raw) : null);
          markSessionPresent();
        } else if (
          (res.status === 401 || res.status === 498) &&
          hasSessionMarker()
        ) {
          const refreshed = await refreshSession();
          if (!cancelled && refreshed) await reloadUser();
        } else if (!cancelled && (res.status === 401 || res.status === 498)) {
          setUser(null);
          clearSessionMarker();
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
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
  }, [refreshSession, reloadUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      logoutSilent,
      refreshSession,
      reloadUser,
    }),
    [user, loading, login, logout, logoutSilent, refreshSession, reloadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------- Hook ---------- */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
