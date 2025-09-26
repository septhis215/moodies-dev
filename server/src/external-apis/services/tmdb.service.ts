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

    async getTVShowsByGenres(genreIds: number[], page = 1, minRating?: number) {
        if (!Array.isArray(genreIds) || genreIds.length === 0) return [];

        const params: Record<string, any> = {
            with_genres: genreIds.join(','),
            page,
            sort_by: 'popularity.desc',
            include_adult: false,
            language: 'en-US',
        };

        try {
            const data = await this.tmdb('/discover/tv', { params });
            return Array.isArray(data?.results) ? data.results : [];
        } catch (err) {
            this.logger.error(`Failed to fetch tv shows by genres ${genreIds.join(',')}: ${err?.message ?? err}`);
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
}