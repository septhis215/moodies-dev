import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

type RedisNamespaceSummary = {
  namespace: string;
  keys: number;
  sampledBytes: number;
  expiring: number;
  persistent: number;
  minTtl: number | null;
};

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClientType;
  private connected = false;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const pass = this.configService.get<string>('REDIS_PASS');
    const port = this.configService.get<number>('REDIS_PORT');

    if (!host || !port) {
      this.logger.warn('Redis is not configured; cache reads will fail open where possible');
      return;
    }

    this.client = createClient({
      username: 'default',
      password: pass,
      socket: { host, port },
    });

    this.client.on('error', (err) =>
      this.logger.error(
        'Redis client error',
        err instanceof Error ? err.stack : String(err),
      ),
    );

    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis client connected');
    } catch (err) {
      this.connected = false;
      this.logger.error(
        'Redis connection failed; cache reads will fail open where possible',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.disconnect();
    }
    this.connected = false;
  }

  private getClient() {
    if (!this.client || !this.connected || !this.client.isOpen) {
      throw new Error('Redis unavailable');
    }
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.getClient().set(key, value, { EX: ttlSeconds });
  }

  async get(key: string) {
    return this.getClient().get(key);
  }

  async del(key: string | string[]) {
    await this.getClient().del(key);
  }

  /**
   * Atomic fixed-window rate-limit hit: increment the counter, set the window TTL
   * on the first hit, and return the current count + remaining TTL in one Redis
   * round trip.
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
    const result = (await this.getClient().eval(script, {
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
    try {
      const cached = await this.getClient().get(key);
      if (cached !== null && cached !== undefined) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          // Corrupted entry: refetch and overwrite if the fresh value is cacheable.
        }
      }
    } catch {
      return fetchFn();
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = this.computeWithLock(key, ttlSeconds, fetchFn, shouldCache).finally(
      () => this.inFlight.delete(key),
    );

    this.inFlight.set(key, promise);
    return promise;
  }

  async deleteByPrefix(prefix: string, batchSize = 100): Promise<number> {
    const client = this.getClient();
    let deleted = 0;
    let batch: string[] = [];

    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: batchSize })) {
      batch.push(String(key));
      if (batch.length >= batchSize) {
        deleted += await client.del(batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      deleted += await client.del(batch);
    }

    return deleted;
  }

  async getSummary(match = '*', sampleLimit = 500) {
    const client = this.getClient();
    const namespaces = new Map<string, Omit<RedisNamespaceSummary, 'namespace'>>();
    let sampled = 0;

    for await (const key of client.scanIterator({ MATCH: match, COUNT: 100 })) {
      if (sampled >= sampleLimit) break;
      const keyName = String(key);
      sampled++;

      const namespace = keyName.split(':')[0] || '(root)';
      const current =
        namespaces.get(namespace) ??
        { keys: 0, sampledBytes: 0, expiring: 0, persistent: 0, minTtl: null };

      current.keys++;

      const [bytes, ttl] = await Promise.all([
        client.memoryUsage(keyName).catch(() => null),
        client.ttl(keyName).catch(() => -2),
      ]);

      if (typeof bytes === 'number') current.sampledBytes += bytes;
      if (ttl > 0) {
        current.expiring++;
        current.minTtl = current.minTtl === null ? ttl : Math.min(current.minTtl, ttl);
      } else if (ttl === -1) {
        current.persistent++;
      }

      namespaces.set(namespace, current);
    }

    const memoryInfo = await client.info('memory').catch(() => '');
    const statsInfo = await client.info('stats').catch(() => '');

    return {
      connected: true,
      match,
      sampled,
      namespaces: Array.from(namespaces.entries())
        .map(([namespace, value]) => ({ namespace, ...value }))
        .sort((a, b) => b.sampledBytes - a.sampledBytes),
      memory: parseRedisInfo(memoryInfo, [
        'used_memory_human',
        'used_memory_peak_human',
        'maxmemory_human',
        'maxmemory_policy',
      ]),
      stats: parseRedisInfo(statsInfo, [
        'keyspace_hits',
        'keyspace_misses',
        'evicted_keys',
        'expired_keys',
      ]),
    };
  }

  private async computeWithLock<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
    shouldCache: (value: T) => boolean,
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    let haveLock = false;

    try {
      const res = await this.getClient().set(lockKey, '1', {
        NX: true,
        PX: LOCK_TTL_MS,
      });
      haveLock = res === 'OK';
    } catch {
      haveLock = true;
    }

    if (!haveLock) {
      const populated = await this.waitForKey<T>(key);
      if (populated !== undefined) return populated;
    }

    try {
      const fresh = await fetchFn();
      if (shouldCache(fresh)) {
        try {
          await this.getClient().set(key, JSON.stringify(fresh), { EX: ttlSeconds });
        } catch {
          // Cache write failed; still return the fresh value.
        }
      }
      return fresh;
    } finally {
      if (haveLock) {
        try {
          await this.getClient().del(lockKey);
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
        const cached = await this.getClient().get(key);
        if (cached !== null && cached !== undefined) {
          return JSON.parse(cached) as T;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function parseRedisInfo(info: string, fields: string[]) {
  const wanted = new Set(fields);
  return info
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const [key, value] = line.split(':');
      if (wanted.has(key)) acc[key] = value;
      return acc;
    }, {});
}

const LOCK_TTL_MS = 10000;
const LOCK_WAIT_MS = 3000;
const LOCK_POLL_MS = 100;
