import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RATE_LIMIT_SCRIPT, type RateLimitBucket, type RateLimitResult } from './rate-limit.script';

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClient;
  private connectPromise?: Promise<RedisClient | null>;
  private nextConnectAt = 0;
  private nextErrorLog = 0;
  private readonly pendingCacheLoads = new Map<string, Promise<unknown>>();

  constructor(private readonly config: ConfigService) {}

  private async getClient(): Promise<RedisClient | null> {
    if (this.client?.isReady) return this.client;
    if (this.connectPromise) return this.connectPromise;
    if (Date.now() < this.nextConnectAt) return null;

    const url = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST');
    const port = this.config.get<number>('REDIS_PORT') ?? 6379;
    const password = this.config.get<string>('REDIS_PASS');
    if (!url && !host) return null;

    this.connectPromise = (async () => {
      const timeout = Number(this.config.get('REDIS_CONNECT_TIMEOUT_MS') ?? 1500);
      const client = createClient({
        ...(url ? { url } : { ...(password ? { password } : {}) }),
        socket: { ...(!url ? { host, port } : {}), connectTimeout: timeout, reconnectStrategy: false },
        disableOfflineQueue: true,
        commandsQueueMaxLength: 10_000,
        commandOptions: { timeout: Number(this.config.get('REDIS_COMMAND_TIMEOUT_MS') ?? 1500) },
      });
      client.on('error', () => this.logUnavailable());
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.connect(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Redis connection timed out')), timeout); }),
        ]);
        await client.ping();
        this.client = client;
        this.logger.log('Redis connection established.');
        return client;
      } catch {
        if (client.isOpen) client.destroy();
        this.nextConnectAt = Date.now() + 5000;
        this.logUnavailable();
        return null;
      } finally {
        if (timer) clearTimeout(timer);
        this.connectPromise = undefined;
      }
    })();
    return this.connectPromise;
  }

  private logUnavailable() {
    if (Date.now() < this.nextErrorLog) return;
    this.nextErrorLog = Date.now() + 60_000;
    this.logger.warn('Redis unavailable. Check connection settings and service health; sensitive rate limits fail closed.');
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    if (ttlSeconds && ttlSeconds > 0) await client.set(key, value, { EX: ttlSeconds });
    else await client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return client ? client.get(key) : null;
  }

  /** Legacy auth reads must distinguish missing tokens from an unavailable store. */
  async getSessionWithTtl(key: string): Promise<{ value: string; ttlSeconds: number } | null> {
    const client = await this.getClient();
    if (!client) throw new ServiceUnavailableException('Session storage is temporarily unavailable');
    const value = await client.get(key);
    if (!value) return null;
    const ttlSeconds = await client.ttl(key);
    return ttlSeconds > 0 ? { value, ttlSeconds } : null;
  }

  async deleteSessionKeys(keys: string[]): Promise<void> {
    const client = await this.getClient();
    if (!client) throw new ServiceUnavailableException('Session storage is temporarily unavailable');
    await client.del(keys);
  }

  async del(key: string | string[]): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    const keys = Array.isArray(key) ? key : [key];
    for (const item of keys) await client.del(item);
  }

  async consumeRateLimits(buckets: RateLimitBucket[]): Promise<RateLimitResult> {
    const client = await this.getClient();
    if (!client) throw new ServiceUnavailableException('Rate-limit storage is temporarily unavailable');
    const result = await client.eval(RATE_LIMIT_SCRIPT, {
      keys: buckets.map(bucket => bucket.key),
      arguments: buckets.flatMap(bucket => [String(bucket.points), String(bucket.windowMs)]),
    });
    if (!Array.isArray(result) || result.length !== 4) throw new ServiceUnavailableException('Invalid rate-limit response');
    return { allowed: Number(result[0]) === 1, index: Number(result[1]) - 1, remaining: Number(result[2]), retryMs: Number(result[3]) };
  }

  /** Fixed-window counter retained for the YouTube daily upstream quota. */
  async rateLimitHit(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
    const client = await this.getClient();
    if (!client) throw new ServiceUnavailableException('Quota storage is temporarily unavailable');
    const result = await client.eval(`
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
      return {count, redis.call('PTTL', KEYS[1])}
    `, { keys: [key], arguments: [String(windowMs)] });
    if (!Array.isArray(result)) throw new ServiceUnavailableException('Invalid quota response');
    return { count: Number(result[0]), ttlMs: Number(result[1]) };
  }

  async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>, shouldCache: (value: T) => boolean = () => true): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      try { return JSON.parse(cached) as T; } catch { await this.del(key); }
    }
    const pending = this.pendingCacheLoads.get(key);
    if (pending) return pending as Promise<T>;
    const load = (async () => {
      const value = await fetchFn();
      if (shouldCache(value)) await this.set(key, JSON.stringify(value), ttlSeconds);
      return value;
    })();
    this.pendingCacheLoads.set(key, load);
    try { return await load; }
    finally { this.pendingCacheLoads.delete(key); }
  }

  async deleteByPrefix(prefix: string, batchSize = 100): Promise<number> {
    const client = await this.getClient();
    if (!client) return 0;
    let deleted = 0;
    let batch: string[] = [];
    for await (const scanned of client.scanIterator({ MATCH: `${prefix}*`, COUNT: batchSize })) {
      for (const key of scanned) batch.push(key);
      if (batch.length >= batchSize) {
        for (const key of batch) deleted += await client.del(key);
        batch = [];
      }
    }
    for (const key of batch) deleted += await client.del(key);
    return deleted;
  }

  async getSummary(match = '*', sampleLimit = 500) {
    const client = await this.getClient();
    if (!client) return { connected: false, match, sampled: 0, namespaces: [], memory: {}, stats: {} };
    const namespaces = new Map<string, { keys: number; sampledBytes: number; expiring: number; persistent: number; minTtl: number | null }>();
    let sampled = 0;
    for await (const scanned of client.scanIterator({ MATCH: match, COUNT: 100 })) {
      for (const key of scanned) {
        if (sampled >= sampleLimit) break;
        const namespace = key.split(':')[0] || '(root)';
        const current = namespaces.get(namespace) ?? { keys: 0, sampledBytes: 0, expiring: 0, persistent: 0, minTtl: null };
        current.keys += 1;
        current.sampledBytes += Number(await client.memoryUsage(key) ?? 0);
        const ttl = await client.ttl(key);
        if (ttl < 0) current.persistent += 1;
        else { current.expiring += 1; current.minTtl = current.minTtl === null ? ttl : Math.min(current.minTtl, ttl); }
        namespaces.set(namespace, current);
        sampled += 1;
      }
      if (sampled >= sampleLimit) break;
    }
    return { connected: true, sampled, match, namespaces: [...namespaces].map(([namespace, values]) => ({ namespace, ...values })), memory: await client.info('memory'), stats: await client.info('stats') };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.close();
    this.client = undefined;
  }
}
