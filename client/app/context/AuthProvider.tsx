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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Normalize /me into our User shape, handling common nestings. */
function extractUser(payload: any): User {
  const p =
    payload?.data?.user ??
    payload?.user ??
    payload?.profile ??
    payload?.data ??
    payload ??
    {};
  const id = p.id ?? p.sub ?? p.userId ?? p.uid;
  const username =
    p.username ?? p.userName ?? p.user_name ?? p.login ?? p.handle;
  const name = p.name ?? p.fullname ?? p.full_name ?? username ?? "User";
  const email = p.email ?? p.mail ?? p.user?.email;
  const avatarUrl = p.avatarUrl ?? p.avatar_url ?? p.picture;
  const provider = p.provider;
  return { id, name, username, email, avatarUrl, provider };
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
      } else if (res.status === 401 || res.status === 498) {
        setUser(null);
      }
    } catch {
      /* network error — keep current state */
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const logoutSilent = useCallback(() => {
    setUser(null);
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
  }, []);

  const login = useCallback(
    async (usr?: User) => {
      if (usr) setUser(usr); // optimistic; server cookie is already set
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
        } else if (res.status === 401 || res.status === 498) {
          const refreshed = await refreshSession();
          if (!cancelled && refreshed) await reloadUser();
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Google sign-in landing: strip the flag from the URL and toast.
      if (isGoogleLanding && typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
        const showToast = (window as any).showToast;
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
