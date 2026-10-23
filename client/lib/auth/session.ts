import { createAppError, type AppError } from "@/lib/errors/app-error";
import { captchaRequestSignal, prepareCaptchaRequest } from "@/lib/turnstile";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api").replace(/\/$/, "");
const SESSION_LOCK = `moodies:refresh:${API_BASE}`;
const SESSION_EVENT_KEY = "moodies:auth-event";
const SESSION_TIMEOUT_MS = 10_000;
export type RefreshResult =
  | { status: "refreshed" }
  | { status: "expired" }
  | { status: "unavailable"; error: AppError };
type SessionEvent = "expired" | "signed-out" | "signed-in" | "recovered";
const listeners = new Set<(event: SessionEvent) => void>();
let pendingRefresh: Promise<RefreshResult> | null = null;
let epoch = 0;
let expired = false;

function publish(event: SessionEvent, broadcast = true) {
  if (event === "expired" && expired) return;
  expired = event === "expired" || event === "signed-out";
  for (const listener of listeners) listener(event);
  if (broadcast && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({ event, nonce: `${Date.now()}:${Math.random()}` }));
    } catch { /* Storage is optional; HttpOnly cookies remain authoritative. */ }
  }
}

export function subscribeSession(listener: (event: SessionEvent) => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as { event?: string };
      if (message.event === "expired" || message.event === "signed-out" || message.event === "signed-in" || message.event === "recovered") {
        if (message.event !== "recovered") resetSessionRequests();
        publish(message.event, false);
      }
    } catch { /* Ignore malformed UI signals. */ }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function resetSessionRequests() {
  epoch++;
  expired = false;
  pendingRefresh = null;
}

export function sessionEpoch() { return epoch; }

async function withSessionLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(SESSION_LOCK, operation);
  }
  // The server also serializes rotation and tolerates bounded duplicate refreshes.
  return operation();
}

function unavailable(status?: number): AppError {
  return createAppError({
    type: status === 429 ? "RATE_LIMIT" : status ? "SERVER" : "NETWORK",
    status,
    code: "AUTH_TEMPORARILY_UNAVAILABLE",
    message: "Session verification temporarily unavailable",
    userMessage: "We could not check your session. Please try again shortly.",
  });
}

async function rawBootstrap() {
  return fetch(`${API_BASE}/auth/bootstrap`, {
    credentials: "include", cache: "no-store", headers: { accept: "application/json" },
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  });
}

export async function refreshSession(): Promise<RefreshResult> {
  if (pendingRefresh) return pendingRefresh;
  const startedEpoch = epoch;
  const operation = withSessionLock(async (): Promise<RefreshResult> => {
    try {
      if (startedEpoch !== epoch) return { status: "unavailable", error: unavailable() };
      // A different tab may already have refreshed while this request waited for the lock.
      const bootstrap = await rawBootstrap();
      if (!bootstrap.ok) return { status: "unavailable", error: unavailable(bootstrap.status) };
      const current = await bootstrap.json() as { user?: { id?: string } };
      if (!current.user?.id) {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST", credentials: "include", cache: "no-store",
          headers: { accept: "application/json" }, signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
        });
        if (startedEpoch !== epoch) return { status: "unavailable", error: unavailable() };
        if (response.status === 401 || response.status === 498) {
          publish("expired");
          return { status: "expired" };
        }
        if (!response.ok) return { status: "unavailable", error: unavailable(response.status) };
      }
      if (startedEpoch !== epoch) return { status: "unavailable", error: unavailable() };
      publish("recovered");
      return { status: "refreshed" };
    } catch {
      return { status: "unavailable", error: unavailable() };
    }
  });
  pendingRefresh = operation;
  try {
    return await operation;
  } finally {
    if (pendingRefresh === operation) pendingRefresh = null;
  }
}

/** Retry only a rejected request, never an ambiguous failed mutation. */
export async function sessionFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const target = new URL(input instanceof Request ? input.url : String(input), API_BASE + "/");
  const api = new URL(API_BASE);
  if (target.origin !== api.origin || !target.pathname.startsWith(api.pathname.replace(/\/$/, "") + "/")) {
    return fetch(input, init);
  }
  const request = new Request(input, { ...init, credentials: "include", cache: "no-store" });
  const startedEpoch = epoch;
  const checkIdentity = () => {
    if (startedEpoch !== epoch) throw createAppError({
      type: "UNAUTHORIZED", code: "AUTH_SESSION_CHANGED", message: "Session changed during request",
      userMessage: "Your sign-in changed. Please try this action again.",
    });
  };
  const prepared = await prepareCaptchaRequest(request.clone());
  checkIdentity();
  const response = await fetch(prepared, { signal: captchaRequestSignal(prepared) });
  checkIdentity();
  if (response.status !== 401 && response.status !== 498) return response;
  const result = await refreshSession();
  checkIdentity();
  request.signal.throwIfAborted();
  if (result.status === "unavailable") throw result.error;
  if (result.status === "expired") return response;
  const retryRequest = await prepareCaptchaRequest(request.clone());
  checkIdentity();
  const retried = await fetch(retryRequest, { signal: captchaRequestSignal(retryRequest) });
  checkIdentity();
  return retried;
}

/** Sign-in/signup must not compete with a refresh response for cookie ownership. */
export async function authenticateSession(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  // Do not hold the cross-tab session lock while a person completes a challenge.
  const request = await prepareCaptchaRequest(new Request(input, { ...init, credentials: "include", cache: "no-store" }));
  return withSessionLock(async () => {
    request.signal.throwIfAborted();
    resetSessionRequests();
    const response = await fetch(request, { signal: captchaRequestSignal(request) });
    if (response.ok) publish("signed-in");
    return response;
  });
}

export async function fetchSessionBootstrap(): Promise<Response> {
  const startedEpoch = epoch;
  const response = await rawBootstrap();
  if (!response.ok) throw unavailable(response.status);
  const boot = await response.clone().json() as { user?: { id?: string }; canRefresh?: boolean };
  if (startedEpoch !== epoch) throw unavailable();
  if (boot.user?.id) return response;
  if (boot.canRefresh === false) {
    // A guest bootstrap is a snapshot, not a cross-tab revocation event. A
    // different tab may be signing in while this response is in flight.
    return response;
  }
  // A missing storage marker must not hide a valid refresh cookie.
  const result = await refreshSession();
  if (result.status === "unavailable") throw result.error;
  if (result.status === "expired") return response;
  const retried = await rawBootstrap();
  if (!retried.ok) throw unavailable(retried.status);
  const verified = await retried.clone().json() as { user?: { id?: string } };
  if (!verified.user?.id) throw unavailable();
  return retried;
}

export async function endSession() {
  await withSessionLock(async () => {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: "POST", credentials: "include", cache: "no-store", signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
    if (!response.ok) throw unavailable(response.status);
    resetSessionRequests();
    publish("signed-out");
  });
}
