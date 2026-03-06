import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MovieTmdbClientService {
    readonly logger = new Logger(MovieTmdbClientService.name);
    readonly baseUrl: string;
    readonly token: string;
    genreMap: Record<number, string> = {};

    private readonly maxConcurrentRequests = 5;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl =
            this.configService.get<string>('TMDB_BASE') ??
            'https://api.themoviedb.org/3';
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    async tmdb(endpoint: string) {
        let normalizedEndpoint: string;

        if (endpoint.startsWith('http')) {
            normalizedEndpoint = endpoint;
        } else {
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
            const cleanBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
            normalizedEndpoint = `${cleanBase}/${cleanEndpoint}`;
        }

        const response = await firstValueFrom(
            this.httpService.get(normalizedEndpoint, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/json',
                },
            }),
        );

        return response.data;
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