import { Injectable, Logger } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { currentTmdbPriority } from './tmdb-priority.context';

@Injectable()
export class TmdbRateLimiterService {
    private readonly logger = new Logger(TmdbRateLimiterService.name);
    private readonly limiter: Bottleneck;
    private readonly inFlight = new Map<string, Promise<any>>();

    constructor() {
        // TMDB free tier: 40 requests / 10 seconds.
        // The reservoir alone enforces TMDB's hard limit; minTime would
        // serialize work that's safe to run in parallel (detail pages fire
        // 7-20 calls per request and need them to overlap, not queue).
        this.limiter = new Bottleneck({
            reservoir: 40,
            reservoirRefreshAmount: 40,
            reservoirRefreshInterval: 10_000,
            maxConcurrent: 10,
        });

        this.limiter.on('failed', (err, jobInfo) => {
            this.logger.warn(
                `TMDB job ${jobInfo.options.id} failed (retry ${jobInfo.retryCount}): ${err?.message ?? err}`,
            );
        });
    }

    /**
     * Schedule a TMDB call through the token-bucket limiter, deduplicating
     * concurrent requests for the same key. All callers waiting on the same
     * key share a single in-flight promise.
     */
    async schedule<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const existing = this.inFlight.get(key);
        if (existing) return existing as Promise<T>;

        // Foreground page loads queue ahead of background enrichment work.
        const priority = currentTmdbPriority();
        const promise = this.limiter
            .schedule({ priority }, fn)
            .finally(() => this.inFlight.delete(key));

        this.inFlight.set(key, promise);
        return promise;
    }
}
