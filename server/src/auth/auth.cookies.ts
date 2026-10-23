import type { Request, Response } from 'express';
import { accessTtlMs, refreshTtlMs } from './auth.config';

/**
 * HttpOnly cookie helpers for the access/refresh token pair.
 *
 * Same-site origins (including different localhost ports, or HTTPS app/API
 * subdomains) can use Lax with host-only cookies on the API. All cross-origin
 * fetches still need credentials: include. Genuinely cross-site deployments
 * need SameSite=None; Secure and browser support for third-party cookies.
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

// Include the public Nest global prefix in browser-facing cookie paths.
export const REFRESH_COOKIE_PATH = '/api/auth';

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

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, expiresAt?: Date): void {
  res.setHeader('Cache-Control', 'no-store');
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: '/auth' });
  const remaining = expiresAt ? Math.max(0, expiresAt.getTime() - Date.now()) : refreshTtlMs();
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), path: '/', maxAge: Math.min(accessTtlMs(), remaining) });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), path: REFRESH_COOKIE_PATH, maxAge: remaining });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: '/auth' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_COOKIE_PATH });
}

/** Zero-dependency cookie reader (avoids pulling in cookie-parser). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
