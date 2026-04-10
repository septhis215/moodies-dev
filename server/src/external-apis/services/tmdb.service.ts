import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaType, Prisma } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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
    private readonly cacheTTL = 1000 * 60 * 60; // 1 hour

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.baseUrl = this.configService.get<string>('TMDB_BASE') ?? 'https://api.themoviedb.org/3';
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    private async tmdb(endpoint: string, opts?: { params?: Record<string, any> }) {
        const normalizedEndpoint = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(normalizedEndpoint, {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        Accept: 'application/json',
                    },
                    params: opts?.params ?? {},
                }),
            );
            return response.data;
        } catch (err: any) {
            this.logger.error(
                `TMDB request failed: ${normalizedEndpoint} — ${err?.response?.status} ${err?.response?.data?.status_message ?? err.message}`,
            );
            throw err;
        }
    }

    /**
     * Get movies by genre IDs using /discover/movie.
     * Sends all genre IDs as a comma-separated list (TMDB OR logic).
     */
    async getMoviesByGenres(genreIds: number[], page = 1, minRating?: number): Promise<TMDBMovie[]> {
        if (!Array.isArray(genreIds) || genreIds.length === 0) return [];

        const params: Record<string, any> = {
            with_genres: genreIds.join(','),
            page,
            sort_by: 'vote_count.desc',
            include_adult: false,
            'vote_count.gte': 100,
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
            sort_by: 'vote_count.desc',
            include_adult: false,
            'vote_count.gte': 20,
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

    private async getCachedContent(genreIds: number[], mediaType: MediaType, minRating: number) {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        return this.prisma.contentCache.findMany({
            where: {
                mediaType,
                voteAverage: { gte: minRating },
                lastFetched: { gte: oneHourAgo },
                genreIds: { hasSome: genreIds },
            },
            orderBy: [{ popularity: 'desc' }, { voteAverage: 'desc' }],
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

        for (const data of cacheData) {
            await this.prisma.contentCache.upsert({
                where: { tmdbId_mediaType: { tmdbId: data.tmdbId, mediaType: data.mediaType } },
                create: data,
                update: { ...data, updatedAt: new Date() },
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
            return results.map((item: any) => ({
                ...item,
                poster_path: item.poster_path ? this.baseImageUrl + item.poster_path : null,
                backdrop_path: item.backdrop_path ? this.baseImageUrl + item.backdrop_path : null,
            }));
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
            return results.map((item: any) => ({
                ...item,
                poster_path: item.poster_path ? this.baseImageUrl + item.poster_path : null,
                backdrop_path: item.backdrop_path ? this.baseImageUrl + item.backdrop_path : null,
            }));
        } catch (err: any) {
            this.logger.error(
                `Failed to fetch trending ${mediaType}/${timeWindow}`,
                err?.response?.data ?? err?.message ?? err,
            );
            throw new HttpException('Failed to fetch trending content from TMDB', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    async cleanOldCache(): Promise<void> {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        await this.prisma.contentCache.deleteMany({
            where: { lastFetched: { lt: twentyFourHoursAgo } },
        });
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