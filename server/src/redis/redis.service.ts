import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClient;
  private connectPromise?: Promise<RedisClient | null>;

  constructor(private readonly config: ConfigService) {}

  private async getClient(): Promise<RedisClient | null> {
    if (this.client?.isReady) return this.client;
    if (this.connectPromise) return this.connectPromise;

    const url = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST');
    const port = this.config.get<number>('REDIS_PORT') ?? 6379;
    const password = this.config.get<string>('REDIS_PASS');
    if (!url && !host) return null;

    this.connectPromise = (async () => {
      const client = createClient({
        ...(url
          ? { url }
          : {
              socket: { host, port, connectTimeout: 5000, reconnectStrategy: retries => Math.min(retries * 250, 5000) },
              ...(password ? { password } : {}),
            }),
      });
      client.on('error', error => this.logger.error(`Redis client error: ${error.message}`));
      try {
        await client.connect();
        await client.ping();
        this.client = client;
        this.logger.log('Redis connection established.');
        return client;
      } catch (error) {
        client.destroy();
        this.logger.error(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      } finally {
        this.connectPromise = undefined;
      }
    })();
    return this.connectPromise;
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

  async del(key: string | string[]): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    const keys = Array.isArray(key) ? key : [key];
    for (const item of keys) await client.del(item);
  }

  async rateLimitHit(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
    const client = await this.getClient();
    if (!client) return { count: 0, ttlMs: windowMs };
    const result = await client.multi().incr(key).pExpire(key, windowMs).exec();
    const count = Number(result?.[0] ?? 0);
    const ttlMs = await client.pTTL(key);
    return { count, ttlMs };
  }

  async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>, shouldCache: (value: T) => boolean = () => true): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      try { return JSON.parse(cached) as T; } catch { await this.del(key); }
    }
    const value = await fetchFn();
    if (shouldCache(value)) await this.set(key, JSON.stringify(value), ttlSeconds);
    return value;
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
