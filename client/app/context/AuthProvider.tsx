"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sGet, sSet, sRemove } from "@/utils/secureStorage";

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
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user?: User) => void;
  logoutSilent: () => void;
};

/* ---------- Config ---------- */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
/** Try these in order; keep/adjust to match your server */
const ME_PATHS = ["/auth/me", "/users/me", "/auth/profile"];

const MOODIES_LOGO = "/images/moodies-transparent.png";
const MOODIES_SIZE = { width: 30, height: 30 };

/* ---------- Utils ---------- */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeJwt<T = any>(token: string): T | null {
  try {
    const b64 = token.split(".")[1];
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function getExpMs(token: string | null): number | null {
  if (!token) return null;
  const p = decodeJwt<{ exp?: number }>(token);
  return p?.exp ? p.exp * 1000 : null;
}

/** Normalize /me (or JWT) into our User shape, handling common nestings */
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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const logoutSilent = useCallback(() => {
    clearTimer();
    sRemove("authToken");
    setToken(null);
    setUser(null); // guest
  }, []);

  const scheduleAutoLogout = useCallback(
    (tkn: string) => {
      clearTimer();
      const expMs = getExpMs(tkn);
      if (!expMs) return;
      const wait = Math.max(0, expMs - Date.now() - 3000); // 3s early
      timerRef.current = window.setTimeout(
        () => logoutSilent(),
        wait
      ) as unknown as number;
    },
    [logoutSilent]
  );

  const login = useCallback(
    (tkn: string, usr?: User) => {
      sSet("authToken", tkn);
      setToken(tkn);

      // show identity immediately (no waiting on /me)
      if (usr) setUser(usr);
      else {
        const p = decodeJwt<any>(tkn);
        if (p) setUser((prev) => prev ?? extractUser(p));
      }

      scheduleAutoLogout(tkn);
    },
    [scheduleAutoLogout]
  );

  /** Try multiple /me paths; if all fail, keep JWT-decoded user */
  const fetchMe = useCallback(
    async (tkn: string) => {
      for (const path of ME_PATHS) {
        try {
          const res = await fetch(`${API_BASE}${path}`, {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${tkn}`,
            },
            cache: "no-store",
          });

          if (res.status === 401 || res.status === 498) {
            logoutSilent();
            return;
          }

          if (res.ok) {
            const raw = await res.json();
            const u = extractUser(raw);
            setUser((prev) => ({ ...(prev ?? {}), ...u }));
            return;
          }
        } catch {
          /* try next path */
        }
      }

      setUser(
        (curr) =>
          curr ??
          (decodeJwt<any>(tkn) ? extractUser(decodeJwt<any>(tkn)) : null)
      );
    },
    [logoutSilent]
  );

  useEffect(() => {
    if (token) fetchMe(token);
  }, [token, fetchMe]);

  useEffect(() => {
    // Check URL for Google login token
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");
      const isGoogleLogin = urlParams.get("google_login");

      if (urlToken && isGoogleLogin) {
        // Store token
        sSet("authToken", urlToken);
        const expiryMs = Date.now() + 1 * 24 * 60 * 60 * 1000;
        sSet("authTokenExpiry", String(expiryMs));

        // Clean URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        // Set token and fetch user
        setToken(urlToken);
        scheduleAutoLogout(urlToken);

        // Fetch user data for toast
        const fetchUserForToast = async () => {
          try {
            const res = await fetch(`${API_BASE}/auth/me`, {
              headers: { Authorization: `Bearer ${urlToken}` },
            });

            if (res.ok) {
              const userData = await res.json();
              sSet("authUser", JSON.stringify(userData));
              sSet("user", JSON.stringify(userData));
              setUser(extractUser(userData));

              // Show success toast
              if (typeof window !== "undefined" && (window as any).showToast) {
                (window as any).showToast(
                  "Welcome back!",
                  "success",
                  3000,
                  userData?.username || userData?.email || "User",
                  userData?.avatarUrl || MOODIES_LOGO,
                  userData?.avatarUrl ? undefined : MOODIES_SIZE
                );
              }
            }
          } catch (error) {
            console.error("Error fetching user:", error);
            // Still show toast even if fetch fails
            if (typeof window !== "undefined" && (window as any).showToast) {
              (window as any).showToast(
                "Welcome back!",
                "success",
                3000,
                "User",
                MOODIES_LOGO,
                MOODIES_SIZE
              );
            }
          }
        };

        fetchUserForToast();
        return;
      }
    }

    // Regular token loading from localStorage
    const t = sGet("authToken");
    if (t) {
      const p = decodeJwt<any>(t);
      if (p) setUser(extractUser(p));
      const exp = getExpMs(t);
      if (exp && exp <= Date.now()) logoutSilent();
      else {
        setToken(t);
        scheduleAutoLogout(t);
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "authToken") {
        if (!e.newValue) { logoutSilent(); return; }
        const plainToken = sGet("authToken");
        if (!plainToken) { logoutSilent(); return; }
        const p2 = decodeJwt<any>(plainToken);
        if (p2) setUser(extractUser(p2));
        setToken(plainToken);
        scheduleAutoLogout(plainToken);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearTimer();
    };
  }, [logoutSilent, scheduleAutoLogout]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      login,
      logoutSilent,
    }),
    [user, token, login, logoutSilent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------- Hook ---------- */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
