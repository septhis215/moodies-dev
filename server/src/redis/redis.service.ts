import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) { }

  private client!: RedisClientType;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const pass = this.configService.get<string>('REDIS_PASS');
    const port = this.configService.get<number>('REDIS_PORT');

    this.client = createClient({
      username: 'default',
      password: pass,
      socket: {
        host: host,
        port: port,
      },
    });

    this.client.on('error', (err) =>
      this.logger.error(
        'Redis client error',
        err instanceof Error ? err.stack : String(err),
      ),
    );
    await this.client.connect();
    this.logger.log('Redis client connected');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  // the life duration of keys, after <number> hours, redis auto-deletes the key.
  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async get(key: string) {
    return await this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  /**
   * Atomic fixed-window rate-limit hit: increment the counter, set the window TTL
   * on the first hit, and return the current count + remaining TTL — one round
   * trip via a Lua script so concurrent requests can't race the expiry. Works
   * across instances, which an in-process counter cannot.
   */
  async rateLimitHit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; ttlMs: number }> {
    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      return { count, redis.call('PTTL', KEYS[1]) }
    `;
    const result = (await this.client.eval(script, {
      keys: [key],
      arguments: [String(windowMs)],
    })) as [number, number];
    return { count: result[0], ttlMs: result[1] };
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
  ): Promise<T> {
    const cached = await this.client.get(key);
    if (cached !== null && cached !== undefined) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Corrupted entry — fall through and refetch.
      }
    }

    // First line of defence: collapse concurrent misses within THIS process.
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = this.computeWithLock(key, ttlSeconds, fetchFn, shouldCache).finally(
      () => this.inFlight.delete(key),
    );

    this.inFlight.set(key, promise);
    return promise;
  }

  // Second line of defence: a short Redis lock so that across MULTIPLE instances
  // only one fetches a cold key; the rest briefly wait for it to be populated.
  // Everything here fails open — any Redis hiccup degrades to "just fetch", which
  // is exactly the pre-lock behaviour, so reads can never be broken by the lock.
  private async computeWithLock<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
    shouldCache: (value: T) => boolean,
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    let haveLock = false;

    try {
      const res = await this.client.set(lockKey, '1', { NX: true, PX: LOCK_TTL_MS });
      haveLock = res === 'OK';
    } catch {
      // Couldn't reach the lock — act as the holder and just fetch.
      haveLock = true;
    }

    if (!haveLock) {
      // Another instance is fetching — wait briefly for the cache to fill.
      const populated = await this.waitForKey<T>(key);
      if (populated !== undefined) return populated;
      // Timed out waiting — fall through and fetch ourselves rather than block.
    }

    try {
      const fresh = await fetchFn();
      if (shouldCache(fresh)) {
        try {
          await this.client.set(key, JSON.stringify(fresh), { EX: ttlSeconds });
        } catch {
          // Cache write failed — still return the fresh value.
        }
      }
      return fresh;
    } finally {
      if (haveLock) {
        try {
          await this.client.del(lockKey);
        } catch {
          // Lock will expire via PX anyway.
        }
      }
    }
  }

  private async waitForKey<T>(key: string): Promise<T | undefined> {
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
      try {
        const cached = await this.client.get(key);
        if (cached !== null && cached !== undefined) {
          return JSON.parse(cached) as T;
        }
      } catch {
        return undefined; // give up waiting; caller will fetch
      }
    }
    return undefined;
  }
}

// Distributed single-flight tuning (milliseconds).
const LOCK_TTL_MS = 10000; // max time one fetcher holds the lock before it auto-expires
const LOCK_WAIT_MS = 3000; // max time a waiter polls for the populated cache
const LOCK_POLL_MS = 100; // gap between polls while waiting
