import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

/**
 * Generic 3-layer read-through used for permanent-ish TMDB data
 * (detail bundles, season bundles, recommendation lists):
 *
 *   Redis (hot L1) -> Postgres/Supabase (permanent L2) -> fetchFresh (TMDB)
 *
 * On an L2 hit that isn't stale, the value is served and Redis is re-warmed.
 * On an L2 miss or stale row, fetchFresh runs and the result is written back to
 * both layers. Cache writes never block the response — a Redis/Postgres failure
 * is logged and the freshly fetched value is still returned.
 */
export interface ReadThroughOptions<T> {
    redisKey: string;
    redisTtlSeconds: number;
    /** Look up the permanent row. Return null if absent. */
    find: () => Promise<{ payload: T; fetchedAt: Date } | null>;
    /** True when a found row is too old and should be refreshed. */
    isStale: (fetchedAt: Date) => boolean;
    /** Persist a freshly fetched payload to the permanent store. */
    upsert: (payload: T) => Promise<void>;
    /** Last-resort fetch (e.g. TMDB) when L1 + L2 miss or are stale. */
    fetchFresh: () => Promise<T>;
    /**
     * Guard against persisting empty/failed results. Returns true when the
     * freshly fetched value is worth caching. Defaults to always caching.
     * (Recommendation fetchers swallow errors into [], so we skip caching those
     * to avoid pinning a transient failure for the full TTL.)
     */
    shouldCache?: (result: T) => boolean;
}

@Injectable()
export class MediaCacheService {
    private readonly logger = new Logger(MediaCacheService.name);

    constructor(private readonly redis: RedisService) {}

    async readThrough<T>(opts: ReadThroughOptions<T>): Promise<T> {
        // ── L1: Redis ──────────────────────────────────────────────
        try {
            const cached = await this.redis.get(opts.redisKey);
            if (cached) return JSON.parse(cached) as T;
        } catch (err) {
            this.logger.warn(`Redis read failed for ${opts.redisKey}: ${(err as Error).message}`);
        }

        // ── L2: Postgres/Supabase ──────────────────────────────────
        try {
            const row = await opts.find();
            if (row && !opts.isStale(row.fetchedAt)) {
                void this.warmRedis(opts.redisKey, opts.redisTtlSeconds, row.payload);
                return row.payload;
            }
        } catch (err) {
            this.logger.warn(`L2 read failed for ${opts.redisKey}: ${(err as Error).message}`);
        }

        // ── L3: fetch fresh, then write back to both layers ────────
        const fresh = await opts.fetchFresh();

        if (!opts.shouldCache || opts.shouldCache(fresh)) {
            void opts
                .upsert(fresh)
                .catch(err => this.logger.warn(`L2 write failed for ${opts.redisKey}: ${err?.message ?? err}`));
            void this.warmRedis(opts.redisKey, opts.redisTtlSeconds, fresh);
        }

        return fresh;
    }

    private async warmRedis<T>(key: string, ttl: number, payload: T) {
        try {
            await this.redis.set(key, JSON.stringify(payload), ttl);
        } catch (err) {
            this.logger.warn(`Redis warm failed for ${key}: ${(err as Error).message}`);
        }
    }

    /** Shared staleness helper: stale once older than maxAgeDays. */
    static isOlderThanDays(fetchedAt: Date, maxAgeDays: number): boolean {
        return Date.now() - new Date(fetchedAt).getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
    }
}
