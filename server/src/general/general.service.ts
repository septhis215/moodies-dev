import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';

export type TmdbGeneral = {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    vote_average?: number;
};

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

@Injectable()
export class GeneralService {
    private readonly logger = new Logger(GeneralService.name);
    private readonly base = 'https://api.themoviedb.org/3';
    private readonly apiKey = process.env.TMDB_API_KEY;
    // small in-memory cache to cut down calls in dev
    private cache: { ts: number; data?: TmdbGeneral[] } = { ts: 0 };

    constructor(private readonly http: HttpService) { }

    async getFeatured(limit = 6): Promise<TmdbGeneral[]> {
        const ttl = 1000 * 60 * 5; // 5 minutes cache

        // return cached slice if within TTL
        if (this.cache.data && Date.now() - this.cache.ts < ttl) {
            return this.cache.data.slice(0, limit);
        }

        if (!this.apiKey) {
            this.logger.warn('TMDB_API_KEY not set; returning empty list');
            return [];
        }

        // Correct TMDB trending endpoint with query string `?api_key=...`
        // use single ? for query string
        const url = `${this.base}/trending/all/week`;

        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }),
        );

        try {
            const results = resp.data?.results ?? [];

            const general: TmdbGeneral[] = (results as any[]).map((m) => ({
                id: m.id,
                title: m.title ?? m.name ?? 'Untitled',
                overview: m.overview ?? '',
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date,
                vote_average: m.vote_average,
            }));

            // cache the full sliced list (we cache the sliced list to keep memory small)
            const shuffled = shuffleArray(general);
            const sliced = shuffled.slice(0, Math.max(0, limit));
            this.cache = { ts: Date.now(), data: sliced };
            return sliced;
        } catch (err) {
            this.logger.error('Failed to fetch TMDB trending', err as any);
            return [];
        }
    }
}
