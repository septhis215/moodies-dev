import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitRule {
  points: number;
  windowMs: number;
}

const DEFAULT_RULE: RateLimitRule = { points: 120, windowMs: 60_000 };
const MOOD_RECOMMENDATION_RULE: RateLimitRule = { points: 30, windowMs: 60_000 };
const MOOD_REGENERATE_RULE: RateLimitRule = { points: 8, windowMs: 60_000 };
const AUTH_RULE: RateLimitRule = { points: 20, windowMs: 60_000 };
// Credential / recovery endpoints are the prime targets for brute force and
// email-bombing, so they get a much tighter budget than general auth traffic.
const AUTH_SENSITIVE_RULE: RateLimitRule = { points: 6, windowMs: 60_000 };

// Only honour client-supplied forwarding headers when explicitly running behind
// a trusted proxy/load balancer. Otherwise an attacker can rotate
// `x-forwarded-for` on every request to mint a fresh bucket and bypass all
// limits entirely.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

// Endpoints where a low, strict limit matters most.
const SENSITIVE_AUTH_PATHS = [
  '/auth/signin',
  '/auth/signup',
  '/auth/request-reset',
  '/auth/verify-code',
  '/auth/reset-password',
  '/auth/change-password',
  '/auth/refresh',
];

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastPruneAt = Date.now();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const now = Date.now();
    const path = this.getPath(request);
    const rule = this.getRule(path);
    const key = `${this.getClientKey(request)}:${request.method}:${path}`;
    const bucket = this.getBucket(key, rule, now);

    bucket.count += 1;
    const remaining = Math.max(0, rule.points - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    response.setHeader('RateLimit-Limit', String(rule.points));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > rule.points) {
      response.setHeader('Retry-After', String(resetSeconds));
      throw new HttpException(
        'Too many requests. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.pruneExpiredBuckets(now);
    return true;
  }

  private getBucket(key: string, rule: RateLimitRule, now: number): RateLimitBucket {
    const current = this.buckets.get(key);
    if (current && current.resetAt > now) return current;

    const next = { count: 0, resetAt: now + rule.windowMs };
    this.buckets.set(key, next);
    return next;
  }

  private getRule(path: string): RateLimitRule {
    if (path.includes('/moods/recommendations/regenerate')) return MOOD_REGENERATE_RULE;
    if (path.includes('/moods/recommendations')) return MOOD_RECOMMENDATION_RULE;
    if (SENSITIVE_AUTH_PATHS.some((p) => path.includes(p))) return AUTH_SENSITIVE_RULE;
    if (path.includes('/auth/')) return AUTH_RULE;
    return DEFAULT_RULE;
  }

  private getClientKey(request: any): string {
    // Trust the proxy's forwarding header only when configured to do so;
    // otherwise it is attacker-controlled and useless as a rate-limit key.
    if (TRUST_PROXY) {
      const forwardedFor = request.headers?.['x-forwarded-for'];
      if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
        return forwardedFor.split(',')[0].trim();
      }
    }

    return request.ip ?? request.socket?.remoteAddress ?? 'anonymous';
  }

  private getPath(request: any): string {
    return request.originalUrl?.split('?')[0] ?? request.url?.split('?')[0] ?? '/';
  }

  private pruneExpiredBuckets(now: number): void {
    if (now - this.lastPruneAt < 60_000) return;

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }

    this.lastPruneAt = now;
  }
}
