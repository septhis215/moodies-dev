import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TMDBService } from 'src/external-apis/services/tmdb.service';

@Injectable()
export class MovieTmdbClientService {
    readonly logger = new Logger(MovieTmdbClientService.name);
    readonly token: string;
    genreMap: Record<number, string> = {};

    private readonly maxConcurrentRequests = 5;

    constructor(
        private readonly tmdbService: TMDBService,
        private readonly configService: ConfigService,
    ) {
        // Kept only as a "is TMDB configured?" guard for consumer services.
        // The actual HTTP credentials live inside TMDBService.
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    async tmdb(endpoint: string) {
        return this.tmdbService.request(endpoint);
    }

    async withConcurrencyLimit<T>(
        tasks: (() => Promise<T>)[],
        limit: number = this.maxConcurrentRequests,
    ): Promise<T[]> {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += limit) {
            const batch = tasks.slice(i, i + limit);
            const batchResults = await Promise.allSettled(batch.map((task) => task()));
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
            const data = await this.tmdb('/genre/movie/list');
            const genres = data?.genres ?? [];
            for (const g of genres) {
                this.genreMap[g.id] = g.name;
            }
            this.logger.log(`Loaded movie genres: ${Object.keys(this.genreMap).length}`);
        } catch (err) {
            this.logger.error('Failed to load genres', err as any);
        }
    }
}