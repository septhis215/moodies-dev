import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { RedisService } from 'src/redis/redis.service';
import type {
  RateLimitBucket,
  RateLimitResult,
} from 'src/redis/rate-limit.script';
import { ClientIpService } from '../security/client-ip.service';
import { ProtectionMetricsService } from '../security/protection-metrics.service';

const WINDOW_MS = 60_000;
const MAX_FALLBACK_BUCKETS = 10_000;
const SENSITIVE = new Set([
  'signin',
  'signup',
  'request-reset',
  'verify-code',
  'reset-password',
  'change-password',
]);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly fallback = new Map<
    string,
    { tokens: number; at: number; expires: number }
  >();
  private nextFailureLog = 0;
  private nextSweep = 0;
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly ips: ClientIpService,
    @Optional() private readonly metrics?: ProtectionMetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const started = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    if (request.method === 'OPTIONS') return true;
    const path = (request.originalUrl ?? request.url ?? '/')
      .split('?')[0]
      .replace(/\/+$/, '')
      .toLowerCase();
    const authAction = /^\/api\/auth\/([^/]+)$/.exec(path)?.[1];
    const sensitive = !!authAction && SENSITIVE.has(authAction);
    const costly =
      path.startsWith('/api/moods/recommendations') ||
      (request.method === 'POST' && /\/snapshot$/.test(path));
    const ip = this.digest(this.ips.get(request));
    const group = this.group(path, request.method, authAction);
    const points = authAction === 'request-reset'
      ? 5
      : sensitive
      ? Number(this.config.get('RATE_LIMIT_AUTH_IP_PER_MINUTE') ?? 30)
      : group === 'regenerate' || group === 'snapshot'
        ? 8
        : authAction === 'refresh'
          ? 120
          : group === 'recommendations'
            ? 30
            : group === 'read'
              ? Number(this.config.get('RATE_LIMIT_READ_IP_PER_MINUTE') ?? 300)
              : 120;
    const buckets: RateLimitBucket[] = [
      {
        key: `rl:v2:ip:${ip}:all`,
        points: Number(this.config.get('RATE_LIMIT_GLOBAL_PER_MINUTE') ?? 600),
        windowMs: WINDOW_MS,
      },
      { key: `rl:v2:ip:${ip}:${group}`, points, windowMs: WINDOW_MS },
    ];
    const email: unknown = request.body?.email;
    if (
      sensitive &&
      typeof email === 'string' &&
      email.trim().length <= 320 &&
      email.trim()
    ) {
      buckets.push({
        key: `rl:v2:account:${this.digest(email.trim().toLowerCase())}:${authAction}`,
        points: authAction === 'request-reset' ? 1 : 6,
        windowMs: WINDOW_MS,
      });
      if (authAction === 'request-reset') {
        buckets.push({
          key: `rl:v2:account:${this.digest(email.trim().toLowerCase())}:reset-hour`,
          points: 5,
          windowMs: 60 * WINDOW_MS,
        });
      }
    }
    if (authAction === 'request-reset') {
      // Share this sending budget across IPs and backend replicas.
      buckets.push({ key: 'rl:v2:password-reset:all', points: 10, windowMs: WINDOW_MS });
    }
    let result: RateLimitResult;
    try {
      result = await this.redis.consumeRateLimits(buckets);
    } catch {
      this.metrics?.record('rate_limit', 'unavailable', Date.now() - started);
      if (Date.now() >= this.nextFailureLog) {
        this.nextFailureLog = Date.now() + WINDOW_MS;
        this.logger.warn(
          'Distributed rate limiting unavailable; protected actions fail closed, public reads use bounded local limits.',
        );
      }
      const sessionMaintenance =
        authAction === 'refresh' || authAction === 'logout';
      if (
        (sensitive ||
          costly ||
          (request.method !== 'GET' && !sessionMaintenance)) &&
        this.config.get<string>('NODE_ENV') !== 'development'
      ) {
        response.setHeader('Retry-After', '5');
        throw new ServiceUnavailableException({
          code: 'RATE_LIMIT_UNAVAILABLE',
          message:
            'This action is temporarily unavailable. Please try again shortly.',
        });
      }
      result = this.consumeFallback(buckets);
    }
    const bucket = buckets[result.index];
    response.setHeader('RateLimit-Limit', String(bucket.points));
    response.setHeader('RateLimit-Remaining', String(result.remaining));
    response.setHeader(
      'RateLimit-Reset',
      String(Math.max(1, Math.ceil(result.retryMs / 1000))),
    );
    if (!result.allowed) {
      this.metrics?.record('rate_limit', 'rejected', Date.now() - started);
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(result.retryMs / 1000))),
      );
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.metrics?.record('rate_limit', 'allowed', Date.now() - started);
    return true;
  }

  private group(path: string, method: string, auth?: string): string {
    if (auth)
      return SENSITIVE.has(auth) ||
        ['refresh', 'bootstrap', 'logout', 'google'].includes(auth)
        ? `auth:${auth}`
        : 'auth:other';
    if (path.startsWith('/api/moods/recommendations'))
      return path.endsWith('/regenerate') ? 'regenerate' : 'recommendations';
    if (path.endsWith('/snapshot')) return 'snapshot';
    if (path.startsWith('/api/reviews') && method !== 'GET')
      return 'review-write';
    // Never put raw URLs, resource IDs or arbitrary input in the key namespace.
    return method === 'GET' ? 'read' : 'write';
  }

  private digest(value: string): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret)
      throw new ServiceUnavailableException('Rate limiting is not configured');
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private consumeFallback(buckets: RateLimitBucket[]): RateLimitResult {
    const now = Date.now();
    if (now >= this.nextSweep) {
      for (const [key, value] of this.fallback)
        if (value.expires <= now) this.fallback.delete(key);
      this.nextSweep = now + WINDOW_MS;
    }
    let selected = 0;
    const available = buckets.map((bucket) => {
      const old = this.fallback.get(bucket.key);
      return old
        ? Math.min(
            bucket.points,
            old.tokens +
              (Math.max(0, now - old.at) * bucket.points) / bucket.windowMs,
          )
        : bucket.points;
    });
    for (let index = 0; index < buckets.length; index++) {
      if (available[index] < 1)
        return {
          allowed: false,
          index,
          remaining: 0,
          retryMs: Math.ceil(
            ((1 - available[index]) * buckets[index].windowMs) /
              buckets[index].points,
          ),
        };
      if (
        available[index] / buckets[index].points <
        available[selected] / buckets[selected].points
      )
        selected = index;
    }
    const newKeys = buckets.filter(
      (bucket) => !this.fallback.has(bucket.key),
    ).length;
    if (this.fallback.size + newKeys > MAX_FALLBACK_BUCKETS)
      throw new ServiceUnavailableException(
        'Traffic protection is temporarily at capacity',
      );
    buckets.forEach((bucket, index) =>
      this.fallback.set(bucket.key, {
        tokens: available[index] - 1,
        at: now,
        expires: now + bucket.windowMs * 2,
      }),
    );
    return {
      allowed: true,
      index: selected,
      remaining: Math.floor(available[selected] - 1),
      retryMs: buckets[selected].windowMs,
    };
  }
}
