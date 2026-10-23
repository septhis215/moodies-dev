import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

// Explicit opt-in: never connects to or deletes keys in the application's Redis.
const url = process.env.RATE_LIMIT_TEST_REDIS_URL;
const suite = url ? describe : describe.skip;
suite('atomic rate limiter against isolated Redis', () => {
  let service: RedisService;
  let second: RedisService;
  let inspect: ReturnType<typeof createClient>;
  const keys: string[] = [];
  const key = () => {
    const value = `captcha-test:${randomUUID()}`;
    keys.push(value);
    return value;
  };
  beforeAll(async () => {
    service = new RedisService(new ConfigService({ REDIS_URL: url }));
    second = new RedisService(new ConfigService({ REDIS_URL: url }));
    inspect = createClient({ url, socket: { reconnectStrategy: false } });
    inspect.on('error', () => undefined);
    await inspect.connect();
  });
  afterAll(async () => {
    if (inspect?.isReady && keys.length) await inspect.del(keys);
    await service?.onModuleDestroy();
    await second?.onModuleDestroy();
    if (inspect?.isOpen) inspect.destroy();
  });
  it('enforces one shared budget across concurrent workers', async () => {
    const bucket = [{ key: key(), points: 10, windowMs: 600_000 }];
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        (index % 2 ? service : second).consumeRateLimits(bucket),
      ),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(10);
    expect(results.filter((result) => !result.allowed)).toHaveLength(90);
  });
  it('refills gradually instead of extending a lockout on every rejected request', async () => {
    const bucket = [{ key: key(), points: 1, windowMs: 120 }];
    expect((await service.consumeRateLimits(bucket)).allowed).toBe(true);
    expect((await service.consumeRateLimits(bucket)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await service.consumeRateLimits(bucket)).allowed).toBe(true);
  });
  it('consumes all budgets atomically, without charging unrelated budgets for a denied operation', async () => {
    const global = { key: key(), points: 10, windowMs: 600_000 };
    const target = { key: key(), points: 1, windowMs: 600_000 };
    await service.consumeRateLimits([target]);
    expect((await service.consumeRateLimits([global, target])).allowed).toBe(
      false,
    );
    expect(await inspect.exists(global.key)).toBe(0);
  });
  it('retains the existing daily-quota API without extending its fixed expiry', async () => {
    const name = key();
    expect((await service.rateLimitHit(name, 1000)).count).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const result = await service.rateLimitHit(name, 1000);
    expect(result.count).toBe(2);
    expect(result.ttlMs).toBeLessThan(980);
  });
});
