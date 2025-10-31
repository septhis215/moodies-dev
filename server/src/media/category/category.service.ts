import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';

export type TmdbAll = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string | null;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    original_language?: string;
    recommendations?: TmdbAll[];
    type?: 'movie' | 'tv';
    trailer_key?: string | null;
    network?: string; // for tv
    created_by?: string; // for tv
    genre_ids?: number[]; // for internal use
    runtime?: number; // for movie
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
export class CategoryService {
    private readonly logger = new Logger(CategoryService.name);
    private readonly baseUrl: string;
    private readonly token: string;
    private genreMap: Record<number, string> = {};
    private readonly maxConcurrentRequests = 5; // TMDB rate limit consideration

    // Cache TTL constants
    private readonly CACHE_TTL = {
        BASIC_DATA: 60 * 60 * 24,      // 5 minutes for trending
        RECOMMENDATIONS: 60 * 60 * 24, // 30 minutes for recommendations
        TRAILERS: 60 * 60 * 24,       // 1 hour for trailers
        GENRES: 60 * 60 * 48     // 24 hours for genres
    };

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl =
            this.configService.get<string>('TMDB_BASE') ??
            'https://api.themoviedb.org/3';
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    // Concurrency control helper
    private async withConcurrencyLimit<T>(
        tasks: (() => Promise<T>)[],
        limit: number = this.maxConcurrentRequests
    ): Promise<T[]> {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += limit) {
            const batch = tasks.slice(i, i + limit);
            const batchResults = await Promise.allSettled(batch.map(task => task()));

            // Fix: Use proper type assertion
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
            }
        }
        return results;
    }

    // Generic helper: returns response.data (not only results)
    private async tmdb(endpoint: string) {
        // Normalize baseUrl + endpoint to avoid double-slashes
        const base = this.baseUrl.replace(/\/+$/, '');       // remove trailing slashes
        const path = endpoint.startsWith('http')
            ? endpoint
            : `${base}/${endpoint.replace(/^\/+/, '')}`;      // remove leading slashes from endpoint

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
                // Resource not found — return null so callers can skip this item
                this.logger.warn(`TMDB 404: ${path}`);
                return null;
            }
            if (status === 429) {
                this.logger.warn(`TMDB rate limited (429) on ${path}`);
                // optionally implement a short retry/backoff here
                return null;
            }
            // Log and rethrow unexpected errors so higher-level handler can decide
            this.logger.error(`TMDB request failed: ${path}`, err);
            throw err;
        }
    }

    private getRecentDate(days: number): string {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    }

    async getTrending(page: number = 1, limit: number = 20): Promise<{ data: TmdbAll[], total: number, page: number, totalPages: number }> {
        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trending');
            return { data: [], total: 0, page: 1, totalPages: 0 };
        }

        try {
            // Calculate which TMDB pages we need based on our pagination
            // Each TMDB page has 20 items, so we need to map our page to TMDB pages
            const itemsPerTmdbPage = 20;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;

            const startTmdbPage = Math.floor(startIndex / itemsPerTmdbPage) + 1;
            const endTmdbPage = Math.floor(endIndex / itemsPerTmdbPage) + 1;

            // Fetch only the required TMDB pages
            const tmdbPagesToFetch: number[] = [];
            for (let p = startTmdbPage; p <= endTmdbPage; p++) {
                tmdbPagesToFetch.push(p);
            }

            const pageTasks = tmdbPagesToFetch.map((p) => {
                return async () => {
                    return this.tmdb(`/trending/all/day?page=${p}&include_adult=false`);
                };
            });

            const fetchedPages = await this.withConcurrencyLimit<any>(pageTasks);

            // Get total pages from first response
            const totalTmdbPages = fetchedPages[0]?.total_pages || 1;
            const totalTmdbResults = fetchedPages[0]?.total_results || 0;

            // Collect all results from fetched pages
            const allResultsRaw = fetchedPages.flatMap((page) => (page?.results ?? []));

            // Filter by recent date
            const filtered = allResultsRaw.filter((m: any) => {
                const date = new Date(m.release_date ?? m.first_air_date ?? '');
                return date >= new Date(this.getRecentDate(365));
            });

            // Dedupe by id
            const uniqueMap = new Map<number, any>();
            for (const item of filtered) {
                if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
            }
            const uniqueItems = Array.from(uniqueMap.values());

            // Format basic data
            let basicItems: TmdbAll[] = uniqueItems.map((m: any) => ({
                id: m.id,
                title: m.title ?? m.name ?? 'Untitled',
                overview: m.overview ?? '',
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date ?? m.first_air_date ?? null,
                vote_average: m.vote_average,
                vote_count: m.vote_count,
                popularity: m.popularity,
                origin_country: m.origin_country ?? [],
                genres: m.genre_ids
                    ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
                    : [],
                type: m.media_type,
                recommendations: [],
            }));

            // Fetch missing origin countries for movies
            const movieWithoutCountry = basicItems.filter(
                (m) => m.type === 'movie' && (!m.origin_country || m.origin_country.length === 0)
            );

            if (movieWithoutCountry.length > 0) {
                const movieDetails = await Promise.allSettled(
                    movieWithoutCountry.map((movie) =>
                        this.tmdb(`/movie/${movie.id}?language=en-US`).catch(() => null)
                    )
                );

                movieDetails.forEach((res, i) => {
                    if (res.status === 'fulfilled' && res.value) {
                        const detail = res.value;
                        const countryCodes =
                            detail.production_countries?.map((c: any) => c.iso_3166_1) ?? [];
                        movieWithoutCountry[i].origin_country = countryCodes;
                    }
                });
            }

            // Calculate which items from the combined results we need
            const startOffset = startIndex % itemsPerTmdbPage;
            const paginatedData = basicItems.slice(startOffset, startOffset + limit);

            // Calculate total pages based on estimated total after filtering
            // Note: This is an approximation since we filter by date
            const estimatedTotal = Math.floor(totalTmdbResults * 0.8); // Assume ~80% pass the date filter
            const totalPagesCalc = Math.ceil(estimatedTotal / limit);

            return {
                data: paginatedData,
                total: estimatedTotal,
                page,
                totalPages: totalPagesCalc
            };
        } catch (err) {
            this.logger.error('Failed to fetch trending', err as any);
            return { data: [], total: 0, page: 1, totalPages: 0 };
        }
    }
}
