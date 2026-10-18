import { createAppError } from "@/lib/errors/app-error";

export type HumanAction =
  | "signup"
  | "signin"
  | "password_reset"
  | "review"
  | "reply"
  | "snapshot";
type ChallengeHandler = (
  action: HumanAction,
  signal: AbortSignal,
) => Promise<string>;
const API = (
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api"
).replace(/\/$/, "");
const CHALLENGE_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 12_000;
let handler: ChallengeHandler | null = null;
let tail: Promise<unknown> = Promise.resolve();
let queued = 0;

export function registerHumanChallenge(next: ChallengeHandler) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function captchaError(message: string) {
  return createAppError({
    type: "VALIDATION",
    code: "CAPTCHA_REQUIRED",
    message,
    userMessage: message,
  });
}

/** Keep endpoint/action policy centralized; never attach a token to third parties. */
export function humanActionFor(
  input: string | URL,
  method: string,
): HumanAction | null {
  const url = new URL(String(input), API + "/");
  const api = new URL(API);
  if (method.toUpperCase() !== "POST" || url.origin !== api.origin) return null;
  const prefix = api.pathname.replace(/\/$/, "");
  if (!url.pathname.startsWith(prefix + "/")) return null;
  const path = url.pathname
    .slice(prefix.length)
    .replace(/\/+$/, "")
    .toLowerCase();
  if (path === "/auth/signup") return "signup";
  if (path === "/auth/signin") return "signin";
  if (path === "/auth/request-reset") return "password_reset";
  if (path === "/reviews") return "review";
  if (/^\/reviews\/[^/]+\/replies$/.test(path)) return "reply";
  if (
    /^\/reviews\/[^/]+\/snapshot$/.test(path) ||
    /^\/content\/[^/]+\/[^/]+\/snapshot$/.test(path)
  )
    return "snapshot";
  return null;
}

/** Each operation receives its own single-use token, including concurrent callers. */
export async function requestHumanVerification(
  action: HumanAction,
  signal: AbortSignal,
): Promise<string> {
  if (queued >= 5)
    throw captchaError(
      "Please finish the current security check before trying another action.",
    );
  queued++;
  const work = tail.then(async () => {
    signal.throwIfAborted();
    if (!handler)
      throw captchaError(
        "Security verification is not ready. Please reload and try again.",
      );
    return handler(action, signal);
  });
  tail = work.catch(() => undefined);
  try {
    return await work;
  } finally {
    queued--;
  }
}

export async function prepareCaptchaRequest(
  request: Request,
): Promise<Request> {
  const action = humanActionFor(request.url, request.method);
  if (!action) return request;
  const challengeSignal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(CHALLENGE_TIMEOUT_MS),
  ]);
  let token: string;
  try {
    token = await requestHumanVerification(action, challengeSignal);
  } catch (error) {
    if (challengeSignal.aborted)
      throw captchaError(
        "The security check timed out or was cancelled. Please try again.",
      );
    throw error;
  }
  request.signal.throwIfAborted();
  const headers = new Headers(request.headers);
  headers.set("x-turnstile-token", token);
  return new Request(request, { headers });
}

export async function captchaFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const request = await prepareCaptchaRequest(new Request(input, init));
  return fetch(request, { signal: captchaRequestSignal(request) });
}

/** Bound verification submissions without changing unrelated request deadlines. */
export function captchaRequestSignal(request: Request): AbortSignal {
  return humanActionFor(request.url, request.method)
    ? AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    : request.signal;
}
