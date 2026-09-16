import { Injectable } from '@nestjs/common';

/**
 * Redis is temporarily disabled.
 *
 * Keep this provider in place because several application services inject it.
 * These compatibility methods intentionally avoid connecting to Redis and
 * make callers fall back to their database/API implementations.
 */
@Injectable()
export class RedisService {
  async set(_key: string, _value: string, _ttlSeconds: number): Promise<void> {
    // Redis disabled: ignore cache writes.
  }

  async get(_key: string): Promise<null> {
    // Redis disabled: always report a cache miss.
    return null;
  }

  async del(_key: string | string[]): Promise<void> {
    // Redis disabled: there is nothing to delete.
  }

  async rateLimitHit(_key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
    // Redis disabled: bypass Redis-backed rate limiting.
    return { count: 0, ttlMs: windowMs };
  }

  async getOrSet<T>(
    _key: string,
    _ttlSeconds: number,
    fetchFn: () => Promise<T>,
    _shouldCache: (value: T) => boolean = () => true,
  ): Promise<T> {
    // Redis disabled: fetch directly without caching or locking.
    return fetchFn();
  }

  async deleteByPrefix(_prefix: string, _batchSize = 100): Promise<number> {
    // Redis disabled: no keys exist in this process to delete.
    return 0;
  }

  async getSummary(match = '*', _sampleLimit = 500) {
    // Redis disabled: preserve the diagnostics response shape.
    return { connected: false, match, sampled: 0, namespaces: [], memory: {}, stats: {} };
  }
}
