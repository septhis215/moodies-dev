import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaType, Prisma } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, lastValueFrom } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';
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
    private readonly cacheTTL = 1000 * 60 * 60; // 1 hour default
    constructor(
        private readonly httpService: HttpService,
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        this.baseUrl = this.configService.get<string>('TMDB_BASE') ?? 'https://api.themoviedb.org/3';
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }
    // Build absolute URL (safe about leading slashes)
    private buildUrl(endpoint: string) {
        if (!endpoint) throw new Error('tmdb endpoint required');
        if (endpoint.startsWith('http')) return endpoint;
        return `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    // generic helper — now accepts optional params object
    private async tmdb(endpoint: string, opts?: { params?: Record<string, any> }) {
        const normalizedEndpoint = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(normalizedEndpoint, {
                    headers: {
                        // correct bearer formatting (no extra braces)
                        Authorization: `Bearer ${this.token}`,
                        Accept: 'application/json',
                    },
                    params: opts?.params ?? {},
                }),
            );

            return response.data;
        } catch (err: any) {
            // surface helpful logs for debugging (do not log token)
            this.logger.error(
                `TMDB request failed: ${normalizedEndpoint} — ${err?.response?.status} ${err?.response?.data?.status_message ?? err.message
                }`,
            );
            throw err;
        }
    }

    /**
  * Get movies by a set of genre IDs using /discover/movie
  * - genreIds: number[] (TMDB genre ids)
  * - page: number (defaults to 1)
  * - minRating: optional number -> maps to vote_average.gte
  */
    async getMoviesByGenres(genreIds: number[], page = 1, minRating?: number) {
        if (!Array.isArray(genreIds) || genreIds.length === 0) {
            return [];
        }

        // Build params, add minRating only if provided
        const params: Record<string, any> = {
            with_genres: genreIds.join(','),
            page,
            sort_by: 'popularity.desc',
            include_adult: false,
            'vote_count.gte': 100, // keep if you want a minimum votes threshold
            language: 'en-US',
        };

        if (typeof minRating === 'number') {
            params['vote_average.gte'] = minRating;
        }

        try {
            const data = await this.tmdb('/discover/movie', { params });
            // data will be the full response object — return results array (or empty)
            return Array.isArray(data?.results) ? data.results : [];
        } catch (err) {
            this.logger.error(`Failed to fetch movies by genres ${genreIds.join(',')}: ${err?.message ?? err}`);
            // rethrow so callers can convert to 503 or fallback
            throw err;
        }
    }

    async getTVShowsByGenres(
        genreIds: number[],
        page = 1,
        minRating?: number,
        limit = 20, // total shows to return
    ) {
        if (!Array.isArray(genreIds) || genreIds.length === 0) return [];
        console.log(genreIds);
        const baseParams: Record<string, any> = {
            page,
            sort_by: 'popularity.desc',
            include_adult: false,
            language: 'en-US',
        };

        try {
            // --- Fetch all genres in parallel
            const perGenrePromises = genreIds.map(id =>
                this.tmdb('/discover/tv', { params: { ...baseParams, with_genres: id } })
                    .then(res => (Array.isArray(res?.results) ? res.results : []))
                    .catch(err => {
                        this.logger.warn(`Failed to fetch TV for genre ${id}: ${err?.message ?? err}`);
                        return [];
                    })
            );

            const perGenreResults = await Promise.all(perGenrePromises);

            // --- Apply optional rating filter + shuffle
            const genreBuckets = perGenreResults.map(results =>
                (minRating
                    ? results.filter(item => (item.vote_average ?? 0) >= minRating)
                    : results
                ).sort(() => Math.random() - 0.5)
            );

            // --- Calculate weights based on bucket sizes
            const totalShows = genreBuckets.reduce((sum, bucket) => sum + bucket.length, 0);
            const genreWeights = genreBuckets.map(bucket =>
                bucket.length / (totalShows || 1)
            );

            // --- Distribute quota per genre based on weight
            const quotas = genreWeights.map(w => Math.max(1, Math.round(w * limit)));

            // --- Pick items per genre respecting quotas
            const final: any[] = [];
            for (let g = 0; g < genreBuckets.length; g++) {
                const picks = genreBuckets[g].slice(0, quotas[g]);
                for (const pick of picks) {
                    if (!final.some(f => f.id === pick.id)) {
                        final.push(pick);
                        if (final.length >= limit) break;
                    }
                }
                if (final.length >= limit) break;
            }

            // --- Trim in case we exceeded due to rounding
            const result = final.slice(0, limit);

            // --- Fallback if no results
            if (result.length === 0) {
                this.logger.warn(
                    `No TV shows found for genres [${genreIds.join(',')}]. Falling back to trending.`
                );
                const fallback = await this.tmdb('/trending/tv/week', { params: baseParams });
                return Array.isArray(fallback?.results)
                    ? fallback.results.slice(0, limit)
                    : [];
            }

            return result;
        } catch (err) {
            this.logger.error(
                `Failed to fetch TV shows by genres ${genreIds.join(',')}: ${err?.message ?? err}`
            );
            throw err;
        }
    }



    private async getCachedContent(genreIds: number[], mediaType: MediaType, minRating: number) {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        return this.prisma.contentCache.findMany({
            where: {
                mediaType,
                voteAverage: { gte: minRating },
                lastFetched: { gte: oneHourAgo },
                genreIds: {
                    hasSome: genreIds,
                },
            },
            orderBy: [
                { popularity: 'desc' },
                { voteAverage: 'desc' },
            ],
            take: 40,
        });
    }

    private async cacheContent(content: any[], mediaType: MediaType) {
        const cacheData = content.map(item => ({
            tmdbId: item.id,
            mediaType,
            title: mediaType === MediaType.MOVIE ? item.title : item.name,
            overview: item.overview,
            genreIds: item.genre_ids,
            voteAverage: new Prisma.Decimal(item.vote_average),
            voteCount: item.vote_count,
            releaseDate: mediaType === MediaType.MOVIE ? item.release_date : item.first_air_date,
            posterPath: item.poster_path,
            backdropPath: item.backdrop_path,
            popularity: new Prisma.Decimal(item.popularity),
            adult: item.adult || false,
            originalLanguage: item.original_language,
            lastFetched: new Date(),
        }));

        // Use upsert to avoid duplicates
        for (const data of cacheData) {
            await this.prisma.contentCache.upsert({
                where: {
                    tmdbId_mediaType: {
                        tmdbId: data.tmdbId,
                        mediaType: data.mediaType,
                    },
                },
                create: data,
                update: {
                    ...data,
                    updatedAt: new Date(),
                },
            });
        }
    }

    private formatCachedMovies(cachedContent: any[]): TMDBMovie[] {
        return cachedContent.map(item => ({
            id: item.tmdbId,
            title: item.title,
            overview: item.overview,
            genre_ids: item.genreIds,
            vote_average: Number(item.voteAverage),
            vote_count: item.voteCount,
            release_date: item.releaseDate || '',
            poster_path: item.posterPath,
            backdrop_path: item.backdropPath,
            adult: item.adult,
            popularity: Number(item.popularity),
            original_language: item.originalLanguage,
        }));
    }

    private formatCachedTVShows(cachedContent: any[]): TMDBTVShow[] {
        return cachedContent.map(item => ({
            id: item.tmdbId,
            name: item.title,
            overview: item.overview,
            genre_ids: item.genreIds,
            vote_average: Number(item.voteAverage),
            vote_count: item.voteCount,
            first_air_date: item.releaseDate || '',
            poster_path: item.posterPath,
            backdrop_path: item.backdropPath,
            popularity: Number(item.popularity),
            original_language: item.originalLanguage,
        }));
    }


    // Get movie genres
    async getMovieGenres(language = 'en-US'): Promise<TMDBGenre[]> {
        try {
            // tmdb helper returns the full response data
            const data = await this.tmdb('/genre/movie/list', { params: { language } });
            return Array.isArray(data?.genres) ? data.genres : [];
        } catch (err) {
            this.logger.error('Failed to fetch movie genres from TMDB', err?.response?.data ?? err?.message ?? err);
            throw new HttpException('Failed to fetch movie genres from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    // Get TV genres
    async getTVGenres(language = 'en-US'): Promise<TMDBGenre[]> {
        try {
            const data = await this.tmdb('/genre/tv/list', { params: { language } });
            return Array.isArray(data?.genres) ? data.genres : [];
        } catch (err) {
            this.logger.error('Failed to fetch TV genres from TMDB', err?.response?.data ?? err?.message ?? err);
            throw new HttpException('Failed to fetch TV genres from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    // Search content (movie | tv)
    async searchContent(query: string, mediaType: 'movie' | 'tv' = 'movie', page = 1, language = 'en-US', includeAdult = false): Promise<any[]> {
        if (!query?.trim()) return [];

        try {
            const data = await this.tmdb(`/search/${mediaType}`, {
                params: {
                    query,
                    page,
                    language,
                    include_adult: includeAdult,
                },
            });

            const results = Array.isArray(data?.results) ? data.results : [];

            // Normalize image URLs
            return results.map((item: any) => ({
                ...item,
                poster_path: item.poster_path ? this.baseImageUrl + item.poster_path : null,
                backdrop_path: item.backdrop_path ? this.baseImageUrl + item.backdrop_path : null,
            }));
        } catch (err) {
            this.logger.error(`Failed to search ${mediaType} for "${query}"`, err?.response?.data ?? err?.message ?? err);
            throw new HttpException('Failed to search content from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    // Get trending content
    async getTrendingContent(mediaType: 'movie' | 'tv' = 'movie', timeWindow: 'day' | 'week' = 'week', language = 'en-US', page = 1): Promise<any[]> {
        try {
            const data = await this.tmdb(`/trending/${mediaType}/${timeWindow}`, {
                params: { language, page },
            });

            const results = Array.isArray(data?.results) ? data.results : [];

            return results.map((item: any) => ({
                ...item,
                poster_path: item.poster_path ? this.baseImageUrl + item.poster_path : null,
                backdrop_path: item.backdrop_path ? this.baseImageUrl + item.backdrop_path : null,
            }));
        } catch (err) {
            this.logger.error(`Failed to fetch trending ${mediaType}/${timeWindow}`, err?.response?.data ?? err?.message ?? err);
            throw new HttpException('Failed to fetch trending content from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    async cleanOldCache(): Promise<void> {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        await this.prisma.contentCache.deleteMany({
            where: {
                lastFetched: {
                    lt: twentyFourHoursAgo,
                },
            },
        });
    }
    /**
   * Fetch keywords for a movie.
   * Returns an object with keywords array (lowercased).
   */
    async getMovieKeywords(movieId: number, language?: string): Promise<{ keywords: string[] }> {
        return this.getKeywordsFor('movie', movieId, language);
    }

    /**
     * Fetch keywords for a TV show.
     * Returns an object with keywords array (lowercased).
     */
    async getTVKeywords(tvId: number, language?: string): Promise<{ keywords: string[] }> {
        return this.getKeywordsFor('tv', tvId, language);
    }

    // ---------------------------------------------------------------------------
    // Internal generic keyword fetcher + caching + retry
    // ---------------------------------------------------------------------------
    private async getKeywordsFor(
        type: 'movie' | 'tv',
        tmdbId: number,
        language?: string
    ): Promise<{ keywords: string[] }> {
        // Cache check
        const cacheKey = `${type}-${tmdbId}`;
        const cached = this.keywordCache.get(tmdbId);
        if (cached && cached.expires > Date.now()) {
            return { keywords: cached.keywords };
        }

        // Build endpoint
        const endpoint = type === 'movie'
            ? `/movie/${tmdbId}/keywords`
            : `/tv/${tmdbId}/keywords`;

        // Try with retries
        const maxAttempts = 3;
        let attempt = 0;
        let lastErr: any = null;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                // Use the consistent tmdb() helper with Bearer auth
                const params: Record<string, any> = {};
                if (language) params.language = language;

                const data = await this.tmdb(endpoint, { params });

                // TMDB returns different shapes for movie vs TV:
                // Movie: { keywords: [...] } or { results: [...] }
                // TV: { results: [...] }
                let rawKeywords: any[] = [];

                if (Array.isArray(data?.keywords)) {
                    rawKeywords = data.keywords;
                } else if (Array.isArray(data?.results)) {
                    rawKeywords = data.results;
                } else if (data?.keywords && Array.isArray(data.keywords.keywords)) {
                    rawKeywords = data.keywords.keywords;
                } else if (data?.keywords && Array.isArray(data.keywords.results)) {
                    rawKeywords = data.keywords.results;
                } else {
                    // Fallback: inspect object for arrays containing 'name' fields
                    const found = Object.values(data || {}).find(
                        v => Array.isArray(v) && v.length > 0 &&
                            typeof v[0] === 'object' && 'name' in v[0]
                    );
                    if (Array.isArray(found)) rawKeywords = found as any[];
                }

                const keywords = Array.from(
                    new Set(
                        rawKeywords
                            .map((k: any) => {
                                if (typeof k === 'string') return k;
                                return k?.name || k?.keyword || '';
                            })
                            .filter(Boolean)
                            .map((s: string) => s.toLowerCase().trim())
                    )
                );

                // Cache result
                this.keywordCache.set(tmdbId, {
                    keywords,
                    expires: Date.now() + this.cacheTTL
                });

                this.logger.debug(
                    `Fetched ${keywords.length} keywords for ${type} ${tmdbId}`
                );

                return { keywords };

            } catch (err: any) {
                lastErr = err;
                const status = err?.response?.status;

                // If 4xx except 429 -> don't retry
                if (status && status >= 400 && status < 500 && status !== 429) {
                    this.logger.debug(
                        `TMDB ${type} keywords fetch failed (status ${status}) for id ${tmdbId}: ${err?.message ?? err}`
                    );
                    break;
                }

                // For 429 or 5xx, exponential backoff and retry
                const backoffMs = Math.pow(2, attempt) * 250;
                this.logger.warn(
                    `TMDB request attempt ${attempt} for ${type} ${tmdbId} failed. ` +
                    `Retrying in ${backoffMs}ms... (${err?.message ?? err})`
                );
                await this.delay(backoffMs);
            }
        }

        // All attempts failed - log and return empty
        this.logger.error(
            `Failed to fetch TMDB ${type} keywords for id ${tmdbId} after ${maxAttempts} attempts: ${lastErr?.message ?? lastErr}`
        );

        // Cache empty for 5 min to avoid hammering
        this.keywordCache.set(tmdbId, {
            keywords: [],
            expires: Date.now() + 1000 * 60 * 5
        });

        return { keywords: [] };
    }

    // small util
    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Optionally: a method to clear the in-memory cache (useful for tests or debug)
    clearKeywordCache() {
        this.keywordCache.clear();
    }
}