import type { Request, Response } from 'express';

/**
 * HttpOnly cookie helpers for the access/refresh token pair.
 *
 * Cross-origin note: when the client and API are served from different sites
 * (e.g. app.moodies.com ↔ api.moodies.com, or :3000 ↔ :4000 in dev), the browser
 * will ONLY attach these cookies to a fetch() if they are SameSite=None; Secure.
 * If they share a parent domain, SameSite=Lax + COOKIE_DOMAIN=.moodies.com works.
 * All of this is env-driven so each environment can be configured without code
 * changes:
 *   COOKIE_SAMESITE = lax | strict | none   (default: lax)
 *   COOKIE_SECURE   = true | false           (default: NODE_ENV === 'production')
 *   COOKIE_DOMAIN   = .moodies.com           (default: host-only)
 *   JWT_ACCESS_EXPIRES   = 15m               (access token TTL)
 *   REFRESH_EXPIRES_DAYS = 30                (refresh token TTL)
 */

export const ACCESS_COOKIE = 'mood_at';
export const REFRESH_COOKIE = 'mood_rt';

// Access cookie lifetime. Kept aligned with the access-token JWT expiry; if the
// cookie outlives the token the client just hits a 401 and silently refreshes.
export const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 minutes

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_EXPIRES_DAYS ?? 30);
export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
export const REFRESH_TTL_SECONDS = Math.floor(REFRESH_TTL_MS / 1000);

function sameSite(): 'lax' | 'strict' | 'none' {
  const v = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  return v === 'none' || v === 'strict' ? (v as 'none' | 'strict') : 'lax';
}

function secure(): boolean {
  if (process.env.COOKIE_SECURE != null) return process.env.COOKIE_SECURE === 'true';
  return process.env.NODE_ENV === 'production';
}

function baseOptions() {
  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    domain?: string;
  } = {
    httpOnly: true,
    secure: secure(),
    sameSite: sameSite(),
  };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  // SameSite=None without Secure is rejected by browsers — force it on.
  if (opts.sameSite === 'none') opts.secure = true;
  return opts;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), path: '/', maxAge: ACCESS_TTL_MS });
  // Refresh cookie is scoped to /auth so it is only ever sent to refresh/logout.
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), path: '/auth', maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: '/auth' });
}

/** Zero-dependency cookie reader (avoids pulling in cookie-parser). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}
