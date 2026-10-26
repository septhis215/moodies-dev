import { ConfigService } from '@nestjs/config';
import {
  HttpException,
  ServiceUnavailableException,
  type ExecutionContext,
} from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { ClientIpService } from '../security/client-ip.service';
import { RedisService } from 'src/redis/redis.service';

describe('layered rate limits', () => {
  const setup = (settings: Record<string, unknown> = {}) => {
    const config = new ConfigService({
      JWT_SECRET: 'rate-limit-test-secret',
      NODE_ENV: 'staging',
      ...settings,
    });
    const consumeRateLimits = jest.fn().mockResolvedValue({
      allowed: true,
      index: 0,
      remaining: 100,
      retryMs: 1000,
    });
    const guard = new RateLimitGuard(
      { consumeRateLimits } as unknown as RedisService,
      config,
      new ClientIpService(config),
    );
    const context = (
      url = '/api/movies/details/1',
      method = 'GET',
      body = {},
      forwarded?: string,
    ) => {
      const headers = new Map<string, string>();
      return {
        headers,
        context: {
          switchToHttp: () => ({
            getRequest: () => ({
              method,
              originalUrl: url,
              body,
              headers: { 'x-forwarded-for': forwarded },
              socket: { remoteAddress: '192.0.2.1' },
            }),
            getResponse: () => ({
              setHeader: (key: string, value: string) =>
                headers.set(key, value),
            }),
          }),
        } as unknown as ExecutionContext,
      };
    };
    return { guard, consumeRateLimits, context };
  };

  it('shares budgets across changing resource IDs, queries and untrusted forwarded IPs', async () => {
    const { guard, consumeRateLimits, context } = setup();
    await guard.canActivate(
      context('/api/movies/details/1?a=b', 'GET', {}, '1.1.1.1').context,
    );
    await guard.canActivate(
      context('/api/tv/details/999', 'GET', {}, '8.8.8.8').context,
    );
    expect(consumeRateLimits.mock.calls[0][0]).toEqual(
      consumeRateLimits.mock.calls[1][0],
    );
    expect(JSON.stringify(consumeRateLimits.mock.calls)).not.toContain(
      '192.0.2.1',
    );
  });
  it('adds an account-specific budget with an HMAC key, not a plaintext email', async () => {
    const { guard, consumeRateLimits, context } = setup();
    await guard.canActivate(
      context('/api/auth/signin', 'POST', { email: ' Member@Example.com ' })
        .context,
    );
    await guard.canActivate(
      context('/api/auth/signin', 'POST', { email: 'member@example.com' })
        .context,
    );
    expect(consumeRateLimits.mock.calls[0][0]).toEqual(
      consumeRateLimits.mock.calls[1][0],
    );
    expect(consumeRateLimits.mock.calls[0][0]).toHaveLength(3);
    expect(JSON.stringify(consumeRateLimits.mock.calls)).not.toContain(
      'example.com',
    );
  });
  it('gives refresh a separate budget from credential guessing', async () => {
    const { guard, consumeRateLimits, context } = setup();
    await guard.canActivate(context('/api/auth/refresh', 'POST').context);
    expect(consumeRateLimits.mock.calls[0][0][1].points).toBe(120);
  });
  it('limits reset requests per account, per IP and across the deployment', async () => {
    const { guard, consumeRateLimits, context } = setup();
    await guard.canActivate(context('/api/auth/request-reset', 'POST', { email: ' Member@Example.com ' }).context);
    const buckets = consumeRateLimits.mock.calls[0][0];
    expect(buckets[1].points).toBe(5);
    expect(buckets[2]).toMatchObject({ points: 1, windowMs: 60_000 });
    expect(buckets[3]).toMatchObject({ points: 5, windowMs: 3_600_000 });
    expect(buckets[4]).toEqual({ key: 'rl:v2:password-reset:all', points: 10, windowMs: 60_000 });
    expect(JSON.stringify(buckets)).not.toContain('example.com');
  });
  it('returns 429 and a usable Retry-After when a shared budget is exhausted', async () => {
    const { guard, consumeRateLimits, context } = setup();
    consumeRateLimits.mockResolvedValue({
      allowed: false,
      index: 1,
      remaining: 0,
      retryMs: 1200,
    });
    const request = context();
    await expect(guard.canActivate(request.context)).rejects.toMatchObject({
      status: 429,
    });
    expect(request.headers.get('Retry-After')).toBe('2');
  });
  it.each([
    '/api/auth/signup',
    '/api/auth/signin',
    '/api/auth/request-reset',
    '/api/content/movie/1/snapshot',
    '/api/reviews',
    '/api/community/posts',
    '/api/community/posts/id/replies',
    '/api/community/posts/id/reactions',
  ])(
    'fails closed for protected writes when Redis is unavailable (%s)',
    async (path) => {
      const { guard, consumeRateLimits, context } = setup();
      consumeRateLimits.mockRejectedValue(new Error('Redis unavailable'));
      await expect(
        guard.canActivate(context(path, 'POST').context),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );
  it('uses a bounded local budget for reads during outages, rather than unlimited fail-open', async () => {
    const { guard, consumeRateLimits, context } = setup({
      RATE_LIMIT_GLOBAL_PER_MINUTE: 2,
    });
    consumeRateLimits.mockRejectedValue(new Error('Redis unavailable'));
    await guard.canActivate(context().context);
    await guard.canActivate(context().context);
    await expect(guard.canActivate(context().context)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
  it.each(['refresh', 'logout'])(
    'keeps session maintenance bounded but available during a Redis outage (%s)',
    async (action) => {
      const { guard, consumeRateLimits, context } = setup();
      consumeRateLimits.mockRejectedValue(new Error('Redis unavailable'));
      await expect(
        guard.canActivate(context(`/api/auth/${action}`, 'POST').context),
      ).resolves.toBe(true);
    },
  );
  it('does not consume preflight budgets', async () => {
    const { guard, consumeRateLimits, context } = setup();
    await guard.canActivate(context('/api/reviews', 'OPTIONS').context);
    expect(consumeRateLimits).not.toHaveBeenCalled();
  });
  it('fails closed for expensive recommendation reads during a Redis outage', async () => {
    const { guard, consumeRateLimits, context } = setup();
    consumeRateLimits.mockRejectedValue(new Error('Redis unavailable'));
    await expect(
      guard.canActivate(context('/api/moods/recommendations', 'GET').context),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
