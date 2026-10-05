import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

type Entry<T> = { value: T; freshUntil: number; expires: number };
@Injectable()
export class MediaCacheService {
  private memory = new Map<string, Entry<unknown>>();
  private pending = new Map<
    string,
    Promise<{ value: unknown; stale: boolean }>
  >();
  private failures = new Map<string, number>();
  constructor(private readonly redis: RedisService) {}

  async read<T>(key: string): Promise<Entry<T> | undefined> {
    const local = this.memory.get(key);
    if (local && local.expires > Date.now()) return local as Entry<T>;
    this.memory.delete(key);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return;
      const entry = JSON.parse(raw) as Entry<T>;
      if (entry.expires > Date.now() && entry.value !== undefined) return entry;
    } catch {
      /* Redis must not prevent discovery. */
    }
  }
  async remember<T>(key: string, value: T, ttl: number) {
    const entry = {
      value,
      freshUntil: Date.now() + ttl * 1000,
      expires: Date.now() + 7 * 86400 * 1000,
    };
    if (this.memory.size >= 200)
      this.memory.delete(this.memory.keys().next().value!);
    this.memory.set(key, entry);
    try {
      await this.redis.set(key, JSON.stringify(entry), 7 * 86400);
    } catch {
      /* use bounded process cache */
    }
  }
  async get<T>(
    key: string,
    ttl: number | ((value: T) => number),
    load: () => Promise<T>,
  ): Promise<{ value: T; stale: boolean }> {
    const cached = await this.read<T>(key);
    if (cached && cached.freshUntil > Date.now())
      return { value: cached.value, stale: false };
    if ((this.failures.get(key) || 0) > Date.now()) {
      if (cached) return { value: cached.value, stale: true };
      throw new Error('Provider cooling down');
    }
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<{ value: T; stale: boolean }>;
    const pending = (async () => {
      try {
        const value = await load();
        await this.remember(
          key,
          value,
          typeof ttl === 'function' ? ttl(value) : ttl,
        );
        this.failures.delete(key);
        return { value, stale: false };
      } catch (error) {
        if (this.failures.size >= 200)
          this.failures.delete(this.failures.keys().next().value!);
        this.failures.set(key, Date.now() + 15 * 60 * 1000);
        if (cached) return { value: cached.value, stale: true };
        throw error;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, pending);
    return pending;
  }
}
