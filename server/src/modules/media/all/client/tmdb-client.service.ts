import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TMDBService } from 'src/external-apis/services/tmdb.service';

@Injectable()
export class TmdbClientService {
    readonly logger = new Logger(TmdbClientService.name);
    readonly baseUrl: string;
    readonly token: string;
    genreMap: Record<number, string> = {};

    private readonly maxConcurrentRequests = 5;

    constructor(
        private readonly tmdbService: TMDBService,
        private readonly configService: ConfigService,
    ) {
        // baseUrl is exposed for sibling services that pre-build full URLs
        // before passing them into tmdb(). request() tolerates absolute URLs.
        this.baseUrl =
            (this.configService.get<string>('TMDB_BASE') ??
            'https://api.themoviedb.org/3').replace(/\/$/, '');
        // token kept as a "is TMDB configured?" guard for consumers.
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    async tmdb(endpoint: string) {
        // Preserves legacy behaviour: swallow 404 and 429 → return null.
        // Sibling services in /all rely on null-on-miss semantics.
        try {
            return await this.tmdbService.request(endpoint);
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 404) {
                this.logger.warn(`TMDB 404: ${endpoint}`);
                return null;
            }
            if (status === 429) {
                this.logger.warn(`TMDB rate limited (429) on ${endpoint}`);
                return null;
            }
            throw err;
        }
    }

    async withConcurrencyLimit<T>(
        tasks: (() => Promise<T>)[],
        limit: number = this.maxConcurrentRequests
    ): Promise<T[]> {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += limit) {
            const batch = tasks.slice(i, i + limit);
            const batchResults = await Promise.allSettled(batch.map(task => task()));
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
            }
        }
        return results;
    }

    async loadGenres() {
        if (!this.token) {
            this.logger.warn('TMDB token not set; skipping loadGenres');
            return;
        }
        try {
            const endpoints = ['/genre/movie/list', '/genre/tv/list'];
            for (const ep of endpoints) {
                const data = await this.tmdb(ep);
                const genres = data?.genres ?? [];
                for (const g of genres) {
                    this.genreMap[g.id] = g.name;
                }
            }
            this.logger.log(`Loaded genres: ${Object.keys(this.genreMap).length}`);
        } catch (err) {
            this.logger.error('Failed to load genres', err as any);
        }
    }
}