import { Injectable, Logger } from '@nestjs/common';
import { MovieTmdbClientService } from '../client/movie-tmdb-client.service';
import { MovieContentFilterService } from '../filters/movie-content-filter.service';
import { MovieRecommendationsService } from '../recommendations/movie-recommendations.service';
import { TmdbMovie } from '../types/movie.types';
import { shuffleArray } from '../utils/helpers';
import { RedisService } from 'src/redis/redis.service';

const MIN_REQUIRED_ITEMS = 25;
const TRAILER_CACHE_TTL = 60 * 60 * 6;
const DEFAULT_UPCOMING_MONTHS = 6;
const DEFAULT_UPCOMING_PREVIEW_PER_MONTH = 18;
const DEFAULT_UPCOMING_PRIORITY_PAGES = 5;
const DEFAULT_UPCOMING_PREVIEW_PAGES = 2;
const TMDB_PAGE_SIZE = 20;

export type UpcomingMovieOptions = {
    months?: number;
    perMonth?: number;
    maxPagesPerMonth?: number;
    region?: string;
    releaseTypes?: string;
    includeTrailers?: boolean;
};

@Injectable()
export class MovieTrailersService {
    private readonly logger = new Logger(MovieTrailersService.name);

    constructor(
        private readonly client: MovieTmdbClientService,
        private readonly filterService: MovieContentFilterService,
        private readonly recommendationsService: MovieRecommendationsService,
        private readonly redisService: RedisService,
    ) { }

    private async cachedTrailers<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
        try {
            return await this.redisService.getOrSet(
                key,
                TRAILER_CACHE_TTL,
                fetcher,
                (value) => Array.isArray(value) ? value.length > 0 : true,
            );
        } catch (err) {
            this.logger.warn(`Trailer cache bypassed for ${key}: ${(err as Error).message}`);
            return fetcher();
        }
    }

    async getTrailers(limit = 30, skipCache = false): Promise<TmdbMovie[]> {
        if (!skipCache) {
            return this.cachedTrailers(`movies:trailers:${limit}`, () => this.getTrailers(limit, true));
        }

        const min = Math.max(MIN_REQUIRED_ITEMS, limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const recentDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0];

            const sources = [
                `discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1`,
                `movie/popular?language=en-US&page=1`,
                `movie/top_rated?language=en-US&page=1`,
                `discover/movie?sort_by=release_date.desc&first_air_date.gte=${recentDate}&page=1`,
            ];

            const allResults: any[] = [];
            for (const url of sources) {
                try {
                    const data = await this.client.tmdb(url);
                    if (data?.results?.length) allResults.push(...data.results);
                } catch (err) {
                    this.logger.warn(`Failed to fetch from source: ${url}`, err);
                }
            }

            const uniqueItems: any[] = [];
            const seenIds = new Set<number>();
            for (const item of allResults) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueItems.push(item);
                }
            }

            const trailerTasks = uniqueItems
                .slice(0, min * 2)
                .map((m: any) => async (): Promise<TmdbMovie | null> => {
                    try {
                        const [videosData, details] = await Promise.all([
                            this.client.tmdb(`movie/${m.id}/videos?language=en-US`),
                            this.client.tmdb(`movie/${m.id}?language=en-US`).catch(() => null),
                        ]);

                        const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
                        let trailer: any = null;
                        for (const trailerType of trailerTypes) {
                            trailer = (videosData?.results ?? []).find(
                                (v: any) => v.type === trailerType && v.site === 'YouTube',
                            );
                            if (trailer) break;
                        }

                        if (!trailer) return null;

                        return {
                            id: m.id,
                            title: m.title ?? m.name ?? 'Untitled',
                            overview: m.overview ?? '',
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: m.release_date ?? null,
                            vote_average: m.vote_average,
                            vote_count: m.vote_count,
                            popularity: m.popularity,
                            trailer_key: trailer.key,
                            recommendations: [],
                            genres: details?.genres ? details.genres.map((g: any) => g.name) : [],
                            origin_country: details?.origin_country ?? m.origin_country ?? [],
                            type: 'movie',
                            genre_ids: details?.genres
                                ? details.genres.map((g: any) => g.id)
                                : (m.genre_ids ?? []),
                        };
                    } catch (err) {
                        this.logger.warn(`Failed to process trailer for ${m.id}`, err);
                        return null;
                    }
                });

            const withTrailers = (await this.client.withConcurrencyLimit(trailerTasks, 3))
                .filter((item): item is TmdbMovie => item !== null)
                .slice(0, min);

            this.recommendationsService.populateRecommendationsBackground(withTrailers);
            return shuffleArray(withTrailers);
        } catch (err) {
            this.logger.error('Failed to fetch trailers', err as any);
            return [];
        }
    }

    private clamp(value: number | undefined, fallback: number, min: number, max: number) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
        return Math.min(max, Math.max(min, Math.floor(value)));
    }

    private formatDate(date: Date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    private getMonthRanges(months: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: months }, (_, index) => {
            const start =
                index === 0
                    ? new Date(today)
                    : new Date(today.getFullYear(), today.getMonth() + index, 1);
            const end = new Date(today.getFullYear(), today.getMonth() + index + 1, 0);
            end.setHours(0, 0, 0, 0);
            return {
                from: this.formatDate(start),
                to: this.formatDate(end),
            };
        });
    }

    private getMonthBudget(monthIndex: number, previewPerMonth: number, maxPagesPerMonth: number) {
        const pages = monthIndex < 2
            ? maxPagesPerMonth
            : Math.min(DEFAULT_UPCOMING_PREVIEW_PAGES, maxPagesPerMonth);

        return {
            pages,
            limit: monthIndex < 2 ? pages * TMDB_PAGE_SIZE : previewPerMonth,
        };
    }

    async getUpcomingTrailers(
        limit?: number,
        options: UpcomingMovieOptions = {},
        skipCache = false,
    ): Promise<TmdbMovie[]> {
        const months = this.clamp(options.months, DEFAULT_UPCOMING_MONTHS, 1, 12);
        const previewPerMonth = this.clamp(options.perMonth, DEFAULT_UPCOMING_PREVIEW_PER_MONTH, 1, 40);
        const maxPagesPerMonth = this.clamp(options.maxPagesPerMonth, DEFAULT_UPCOMING_PRIORITY_PAGES, 1, 5);
        const totalBudget = Array.from({ length: months }, (_, index) =>
            this.getMonthBudget(index, previewPerMonth, maxPagesPerMonth).limit,
        ).reduce((sum, monthLimit) => sum + monthLimit, 0);
        const requestedLimit = this.clamp(limit, totalBudget, 1, totalBudget);
        const region = (options.region || 'US').toUpperCase();
        const releaseTypes = options.releaseTypes || '2|3';
        const includeTrailers = options.includeTrailers === true;

        if (!skipCache) {
            const cacheKey = [
                'movies:upcomingMonthly',
                'v4',
                requestedLimit,
                months,
                previewPerMonth,
                maxPagesPerMonth,
                region,
                releaseTypes,
                includeTrailers ? 'trailers' : 'basic',
            ].join(':');

            return this.cachedTrailers(cacheKey, () =>
                this.getUpcomingTrailers(requestedLimit, {
                    months,
                    perMonth: previewPerMonth,
                    maxPagesPerMonth,
                    region,
                    releaseTypes,
                    includeTrailers,
                }, true),
            );
        }

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const monthTasks = this.getMonthRanges(months).map((range, monthIndex) => async () => {
                const monthItems: TmdbMovie[] = [];
                const monthBudget = this.getMonthBudget(monthIndex, previewPerMonth, maxPagesPerMonth);

                for (let page = 1; page <= monthBudget.pages && monthItems.length < monthBudget.limit; page++) {
                    const data = await this.client.tmdb(
                        `discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}` +
                        `&sort_by=popularity.desc&with_release_type=${releaseTypes}&region=${region}` +
                        `&primary_release_date.gte=${range.from}&primary_release_date.lte=${range.to}`,
                    );

                    const results = data?.results ?? [];
                    if (results.length === 0) break;

                    monthItems.push(
                        ...results
                            .filter(
                                (m: any) =>
                                    m.id &&
                                    m.poster_path &&
                                    m.release_date &&
                                    m.release_date >= range.from &&
                                    m.release_date <= range.to,
                            )
                            .map((m: any) => ({
                                id: m.id,
                                title: m.title ?? 'Untitled',
                                overview: m.overview ?? '',
                                poster_path: m.poster_path ?? null,
                                backdrop_path: m.backdrop_path ?? null,
                                release_date: m.release_date,
                                vote_average: m.vote_average ?? 0,
                                vote_count: m.vote_count ?? 0,
                                popularity: m.popularity ?? 0,
                                trailer_key: null,
                                type: 'movie' as const,
                                recommendations: [],
                                genres: m.genre_ids
                                    ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                                    : [],
                                genre_ids: m.genre_ids ?? [],
                            })),
                    );
                }

                const uniqueMonthItems = Array.from(
                    new Map(monthItems.map((item) => [item.id, item])).values(),
                );
                return uniqueMonthItems
                    .sort(
                        (a, b) =>
                            (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
                            (b.release_date ? new Date(b.release_date).getTime() : Infinity),
                    )
                    .slice(0, monthBudget.limit);
            });

            const monthlyItems = (await this.client.withConcurrencyLimit(monthTasks, 2)).flat();

            const uniqueItems = Array.from(
                new Map(monthlyItems.map((item) => [item.id, item])).values(),
            );

            const sorted = uniqueItems
                .sort(
                    (a, b) =>
                        (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
                        (b.release_date ? new Date(b.release_date).getTime() : Infinity),
                );

            const result = sorted.slice(0, requestedLimit);

            if (includeTrailers) {
                const trailerTasks = result.map((item) => async () => {
                    try {
                        const videosData = await this.client.tmdb(`movie/${item.id}/videos?language=en-US`);
                        const trailer = ['Trailer', 'Teaser', 'Clip']
                            .map((trailerType) =>
                                (videosData?.results ?? []).find(
                                    (v: any) => v.type === trailerType && v.site === 'YouTube',
                                ),
                            )
                            .find(Boolean);
                        item.trailer_key = trailer?.key ?? null;
                    } catch {
                        item.trailer_key = null;
                    }
                    return item;
                });
                await this.client.withConcurrencyLimit(trailerTasks, 3);
            }

            return result;
        } catch (err) {
            this.logger.error('Failed to fetch upcoming trailers', err as any);
            return [];
        }
    }

    async getTrailersForItems(
        items: { type: 'movie'; id: number }[],
    ): Promise<Record<string, string | null>> {
        const tasks = items.map((item) => async () => {
            try {
                const videosData = await this.client.tmdb(`movie/${item.id}/videos?language=en-US`);
                const trailer = (videosData?.results ?? []).find(
                    (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
                );
                return [`movie-${item.id}`, trailer?.key ?? null];
            } catch {
                return [`movie-${item.id}`, null];
            }
        });

        const results = await this.client.withConcurrencyLimit(tasks);
        return Object.fromEntries(results);
    }
}
