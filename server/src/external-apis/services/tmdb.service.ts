import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';
import { TmdbRateLimiterService } from './tmdb-rate-limiter.service';

export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    genre_ids: number[];
    vote_average: number;
    vote_count: number;
    release_date: string;
    poster_path: string;
    backdrop_path: string;
    adult: boolean;
    popularity: number;
    original_language: string;
}

export interface TMDBTVShow {
    id: number;
    name: string;
    overview: string;
    genre_ids: number[];
    vote_average: number;
    vote_count: number;
    first_air_date: string;
    poster_path: string;
    backdrop_path: string;
    popularity: number;
    original_language: string;
}

export interface TMDBGenre {
    id: number;
    name: string;
}

@Injectable()
export class TMDBService {
    private readonly baseImageUrl = 'https://image.tmdb.org/t/p/w500';
    private readonly logger = new Logger(TMDBService.name);
    private readonly baseUrl: string;
    private readonly token: string;
    private readonly keywordCache = new Map<number, { keywords: string[]; expires: number }>();
    private readonly cacheTTL = 1000 * 60 * 60; // 1 hour

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly rateLimiter: TmdbRateLimiterService,
        private readonly redis: RedisService,
    ) {
        this.baseUrl = (this.configService.get<string>('TMDB_BASE') ?? 'https://api.themoviedb.org/3').replace(/\/$/, '');
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    /**
     * Public TMDB call — every consumer outside TMDBService should funnel
     * through here so they inherit Redis caching, request dedup, and rate
     * limiting. Tolerates legacy patterns:
     *   - leading slash optional (`person/123` or `/person/123`)
     *   - inline query strings (`search/movie?query=foo`) get split into params
     */
    async request<T = any>(
        endpoint: string,
        opts?: { params?: Record<string, any> },
    ): Promise<T> {
        const params: Record<string, any> = { ...(opts?.params ?? {}) };
        let path = endpoint;

        const queryIdx = path.indexOf('?');
        if (queryIdx >= 0) {
            const queryString = path.slice(queryIdx + 1);
            path = path.slice(0, queryIdx);
            for (const pair of queryString.split('&')) {
                if (!pair) continue;
                const eq = pair.indexOf('=');
                const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
                const rawVal = eq >= 0 ? pair.slice(eq + 1) : '';
                params[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal);
            }
        }

        if (!path.startsWith('/') && !path.startsWith('http')) {
            path = `/${path}`;
        }

        return this.tmdb(path, { params }) as Promise<T>;
    }

    private async tmdb(endpoint: string, opts?: { params?: Record<string, any> }) {
        const normalizedEndpoint = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const params = opts?.params ?? {};
        const dedupKey = `${normalizedEndpoint}?${this.stableQuery(params)}`;
        const ttl = this.resolveTtl(endpoint);

        const fetcher = () =>
            this.rateLimiter.schedule(dedupKey, async () => {
                try {
                    const response = await firstValueFrom(
                        this.httpService.get(normalizedEndpoint, {
                            headers: {
                                Authorization: `Bearer ${this.token}`,
                                Accept: 'application/json',
                            },
                            params,
                        }),
                    );
                    return response.data;
                } catch (err: any) {
                    const status = err?.response?.status;
                    const msg = `TMDB request failed: ${normalizedEndpoint} — ${status} ${err?.response?.data?.status_message ?? err.message}`;
                    if (status === 404) {
                        this.logger.warn(msg);
                    } else {
                        this.logger.error(msg);
                    }
                    throw err;
                }
            });

        if (ttl > 0) {
            return this.redis.getOrSet(`tmdb:${dedupKey}`, ttl, fetcher);
        }
        return fetcher();
    }

    private stableQuery(params: Record<string, any>): string {
        return Object.keys(params)
            .sort()
            .map(k => `${k}=${params[k]}`)
            .join('&');
    }

    private resolveTtl(endpoint: string): number {
        let path = endpoint.startsWith('http') ? new URL(endpoint).pathname : endpoint;
        // Callers pass either relative paths ("movie/123") or full absolute URLs
        // ("https://api.themoviedb.org/3//movie/123"). Strip the TMDB version
        // base (/3) and collapse double slashes so prefix matching works for
        // both — otherwise absolute-URL callers (the /all/* services) silently
        // bypass the cache.
        path = path.replace(/^\/3(?=\/)/, '').replace(/\/{2,}/g, '/');
        if (!path.startsWith('/')) path = `/${path}`;

        // Image lists are the largest single payloads (every backdrop/poster/
        // logo with metadata) and are low value to persist — skip the cache so
        // they don't crowd out far more useful detail entries in Redis.
        if (path.endsWith('/images') || path.endsWith('/tagged_images')) return 0;

        if (path.startsWith('/trending/')) {
            return path.endsWith('/day') ? 4 * 60 * 60 : 12 * 60 * 60;
        }
        if (path.startsWith('/search/')) return 2 * 60 * 60;
        if (path.startsWith('/discover/')) return 60 * 60;
        if (path.startsWith('/genre/')) return 24 * 60 * 60;

        // Collections almost never change; cache aggressively. They recur heavily
        // during recommendation enrichment.
        if (path.startsWith('/collection/')) return 24 * 60 * 60;

        // Detail pages and their sub-resources change slowly. Cache 6 hours so
        // a TV detail page (and its videos/credits/etc.) is near-instant on revisit.
        if (
            path.startsWith('/movie/') ||
            path.startsWith('/tv/') ||
            path.startsWith('/person/')
        ) {
            return 6 * 60 * 60;
        }

        return 0;
    }

    /**
     * Get movies by genre IDs using /discover/movie.
     * Sends genre IDs with TMDB OR logic so broad moods collect enough
     * candidates and the mood scorer can rank the best overlaps.
     */
    async getMoviesByGenres(genreIds: number[], page = 1, minRating?: number): Promise<TMDBMovie[]> {
        if (!Array.isArray(genreIds) || genreIds.length === 0) return [];

        const params: Record<string, any> = {
            with_genres: genreIds.join('|'),
            page,
            sort_by: 'popularity.desc',
            include_adult: false,
            'vote_count.gte': 150,
            language: 'en-US',
        };

        if (typeof minRating === 'number') params['vote_average.gte'] = minRating;

        try {
            const data = await this.tmdb('/discover/movie', { params });
            return Array.isArray(data?.results) ? data.results : [];
        } catch (err: any) {
            this.logger.error(`Failed to fetch movies by genres [${genreIds.join(',')}]: ${err?.message ?? err}`);
            throw err;
        }
    }

    /**
     * Get TV shows by genre IDs using /discover/tv.
     *
     * FIX: The old implementation fired one API call *per genre ID* in parallel,
     * then manually weighted and quota-distributed the results. This had three
     * problems:
     *   1. It made N×pages API calls instead of 1, hammering TMDB rate limits.
     *   2. The per-genre quota system fought the scoring engine — items were
     *      pre-filtered by genre balance before scoring had a chance to rank
     *      them, so the best cross-genre items were under-represented.
     *   3. The `sort(() => Math.random() - 0.5)` shuffle inside the quota loop
     *      meant popular/quality shows were randomly dropped in favour of
     *      obscure ones.
     *
     * The fix sends all genre IDs as a single `with_genres` (OR) query so TMDB
     * does the filtering server-side. The caller (MoodsService.scoreItem) then
     * applies genre weights as part of the Jaccard score, which is the correct
     * place for that logic.
     *
     * A fallback to /trending/tv/week is preserved for when discover returns
     * nothing (e.g. very niche genre combination).
     */
    async getTVShowsByGenres(genreIds: number[], page = 1, minRating?: number): Promise<TMDBTVShow[]> {
        if (!Array.isArray(genreIds) || genreIds.length === 0) return [];

        const params: Record<string, any> = {
            with_genres: genreIds.join('|'), // | = OR in TMDB discover
            page,
            sort_by: 'popularity.desc',
            include_adult: false,
            'vote_count.gte': 75,
            language: 'en-US',
        };

        if (typeof minRating === 'number') params['vote_average.gte'] = minRating;

        try {
            const data = await this.tmdb('/discover/tv', { params });
            const results: TMDBTVShow[] = Array.isArray(data?.results) ? data.results : [];

            if (results.length === 0) {
                this.logger.warn(
                    `No TV shows found for genres [${genreIds.join(',')}]. Falling back to trending.`,
                );
                const fallback = await this.tmdb('/trending/tv/week', {
                    params: { page, language: 'en-US' },
                });
                return Array.isArray(fallback?.results) ? fallback.results : [];
            }

            return results;
        } catch (err: any) {
            this.logger.error(
                `Failed to fetch TV shows by genres [${genreIds.join(',')}]: ${err?.message ?? err}`,
            );
            throw err;
        }
    }

    async getMovieGenres(language = 'en-US'): Promise<TMDBGenre[]> {
        try {
            const data = await this.tmdb('/genre/movie/list', { params: { language } });
            return Array.isArray(data?.genres) ? data.genres : [];
        } catch (err: any) {
            this.logger.error('Failed to fetch movie genres from TMDB', err?.response?.data ?? err?.message ?? err);
            throw new HttpException('Failed to fetch movie genres from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    async getTVGenres(language = 'en-US'): Promise<TMDBGenre[]> {
        try {
            const data = await this.tmdb('/genre/tv/list', { params: { language } });
            return Array.isArray(data?.genres) ? data.genres : [];
        } catch (err: any) {
            this.logger.error('Failed to fetch TV genres from TMDB', err?.response?.data ?? err?.message ?? err);
            throw new HttpException('Failed to fetch TV genres from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    async searchContent(
        query: string,
        mediaType: 'movie' | 'tv' = 'movie',
        page = 1,
        language = 'en-US',
        includeAdult = false,
    ): Promise<any[]> {
        if (!query?.trim()) return [];

        try {
            const data = await this.tmdb(`/search/${mediaType}`, {
                params: { query, page, language, include_adult: includeAdult },
            });

            const results = Array.isArray(data?.results) ? data.results : [];
            return results;
        } catch (err: any) {
            this.logger.error(
                `Failed to search ${mediaType} for "${query}"`,
                err?.response?.data ?? err?.message ?? err,
            );
            throw new HttpException('Failed to search content from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    async getTrendingContent(
        mediaType: 'movie' | 'tv' = 'movie',
        timeWindow: 'day' | 'week' = 'week',
        language = 'en-US',
        page = 1,
    ): Promise<any[]> {
        try {
            const data = await this.tmdb(`/trending/${mediaType}/${timeWindow}`, {
                params: { language, page },
            });

            const results = Array.isArray(data?.results) ? data.results : [];
            return results;
        } catch (err: any) {
            this.logger.error(
                `Failed to fetch trending ${mediaType}/${timeWindow}`,
                err?.response?.data ?? err?.message ?? err,
            );
            throw new HttpException('Failed to fetch trending content from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    async getMovieKeywords(movieId: number, language?: string): Promise<{ keywords: string[] }> {
        return this.getKeywordsFor('movie', movieId, language);
    }

    async getTVKeywords(tvId: number, language?: string): Promise<{ keywords: string[] }> {
        return this.getKeywordsFor('tv', tvId, language);
    }

    private async getKeywordsFor(
        type: 'movie' | 'tv',
        tmdbId: number,
        language?: string,
    ): Promise<{ keywords: string[] }> {
        const cached = this.keywordCache.get(tmdbId);
        if (cached && cached.expires > Date.now()) return { keywords: cached.keywords };

        const endpoint = type === 'movie' ? `/movie/${tmdbId}/keywords` : `/tv/${tmdbId}/keywords`;
        const maxAttempts = 3;
        let attempt = 0;
        let lastErr: any = null;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                const params: Record<string, any> = {};
                if (language) params.language = language;

                const data = await this.tmdb(endpoint, { params });

                let rawKeywords: any[] = [];
                if (Array.isArray(data?.keywords)) rawKeywords = data.keywords;
                else if (Array.isArray(data?.results)) rawKeywords = data.results;
                else if (data?.keywords && Array.isArray(data.keywords.keywords)) rawKeywords = data.keywords.keywords;
                else if (data?.keywords && Array.isArray(data.keywords.results)) rawKeywords = data.keywords.results;
                else {
                    const found = Object.values(data || {}).find(
                        v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && 'name' in v[0],
                    );
                    if (Array.isArray(found)) rawKeywords = found as any[];
                }

                const keywords = Array.from(
                    new Set(
                        rawKeywords
                            .map((k: any) => (typeof k === 'string' ? k : k?.name || k?.keyword || ''))
                            .filter(Boolean)
                            .map((s: string) => s.toLowerCase().trim()),
                    ),
                );

                this.keywordCache.set(tmdbId, { keywords, expires: Date.now() + this.cacheTTL });
                this.logger.debug(`Fetched ${keywords.length} keywords for ${type} ${tmdbId}`);
                return { keywords };
            } catch (err: any) {
                lastErr = err;
                const status = err?.response?.status;

                if (status && status >= 400 && status < 500 && status !== 429) {
                    this.logger.debug(
                        `TMDB ${type} keywords fetch failed (status ${status}) for id ${tmdbId}: ${err?.message ?? err}`,
                    );
                    break;
                }

                const backoffMs = Math.pow(2, attempt) * 250;
                this.logger.warn(
                    `TMDB request attempt ${attempt} for ${type} ${tmdbId} failed. Retrying in ${backoffMs}ms...`,
                );
                await this.delay(backoffMs);
            }
        }

        this.logger.error(
            `Failed to fetch TMDB ${type} keywords for id ${tmdbId} after ${maxAttempts} attempts: ${lastErr?.message ?? lastErr}`,
        );
        this.keywordCache.set(tmdbId, { keywords: [], expires: Date.now() + 1000 * 60 * 5 });
        return { keywords: [] };
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearKeywordCache() {
        this.keywordCache.clear();
    }
}
