import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TmdbClientService {
    readonly logger = new Logger(TmdbClientService.name);
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
        const base = this.baseUrl.replace(/\/+$/, '');
        const path = endpoint.startsWith('http')
            ? endpoint
            : `${base}/${endpoint.replace(/^\/+/, '')}`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(path, {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        Accept: 'application/json',
                    },
                })
            );
            return response.data;
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 404) {
                this.logger.warn(`TMDB 404: ${path}`);
                return null;
            }
            if (status === 429) {
                this.logger.warn(`TMDB rate limited (429) on ${path}`);
                return null;
            }
            this.logger.error(`TMDB request failed: ${path}`, err);
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