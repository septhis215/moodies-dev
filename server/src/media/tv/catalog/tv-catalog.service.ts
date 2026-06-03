import { Injectable, Logger } from '@nestjs/common';
import { TvTmdbClientService } from '../client/tv-tmdb-client.service';
import { TvContentFilterService } from '../filters/tv-content-filter.service';
import { TvRecommendationsService } from '../recommendations/tv-recommendations.service';
import { TmdbTv, TvListResult } from '../types/tv.types';
import { shuffleArray, getRecentDate, paginateItems, mapToTmdbTv } from '../utils/helpers';
import { RedisService } from 'src/redis/redis.service';

const MIN_REQUIRED_ITEMS = 30;
const LIST_CACHE_TTL = 60 * 60 * 6;

@Injectable()
export class TvCatalogService {
    private readonly logger = new Logger(TvCatalogService.name);

    constructor(
        private readonly client: TvTmdbClientService,
        private readonly filterService: TvContentFilterService,
        private readonly recommendationsService: TvRecommendationsService,
        private readonly redisService: RedisService,
    ) { }

    // ─── Shared helpers ──────────────────────────────────────────────────────────

    private min(limit: number) {
        return Math.max(MIN_REQUIRED_ITEMS, limit);
    }

    private emptyPaginated(page: number) {
        return { data: [], page, totalPages: 0, total: 0 };
    }

    private async fetchPages(
        urlBuilder: (page: number) => string,
        minRequired: number,
        maxPages: number,
        filter?: (results: any[]) => any[],
    ): Promise<any[]> {
        const allResults: any[] = [];
        let currentPage = 1;

        while (allResults.length < minRequired && currentPage <= maxPages) {
            const data = await this.client.tmdb(urlBuilder(currentPage));
            const raw = data?.results ?? [];
            const results = filter ? filter(raw) : raw;
            allResults.push(...results);
            currentPage++;
            if (results.length === 0) break;
        }

        return Array.from(new Map(allResults.map((item) => [item.id, item])).values());
    }

    private async cachedList<T>(
        key: string,
        fetcher: () => Promise<T>,
        shouldCache = (value: T) => Array.isArray(value) ? value.length > 0 : true,
    ): Promise<T> {
        try {
            return await this.redisService.getOrSet(key, LIST_CACHE_TTL, fetcher, shouldCache);
        } catch (err) {
            this.logger.warn(`List cache bypassed for ${key}: ${(err as Error).message}`);
            return fetcher();
        }
    }

    private returnOrPaginate(
        items: TmdbTv[],
        limit: number,
        page?: number,
        withBackground = true,
    ): TvListResult {
        const minReq = this.min(limit);

        if (!page) {
            const slice = items.slice(0, minReq);
            if (withBackground) this.recommendationsService.populateRecommendationsBackground(slice);
            return slice;
        }

        const result = paginateItems(items, page, limit);
        if (withBackground) this.recommendationsService.populateRecommendationsBackground(result.data);
        return result;
    }

    // ─── Featured ────────────────────────────────────────────────────────────────

    async getFeatured(limit = 30, skipCache = false): Promise<TmdbTv[]> {
        if (!skipCache) return this.cachedList(`tv:featured:${limit}`, () => this.getFeatured(limit, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty featured');
            return [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `/discover/tv?sort_by=popularity.desc&include_adult=false&page=${p}&first_air_date.gte=${getRecentDate(365)}&without_keywords=13090,190720`,
                minReq,
                5,
            );

            const items: TmdbTv[] = uniqueItems.map((m: any) => ({
                id: m.id,
                title: m.title ?? m.name ?? 'Untitled',
                overview: m.overview ?? '',
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date ?? m.first_air_date ?? null,
                vote_average: m.vote_average,
                vote_count: m.vote_count,
                popularity: m.popularity,
                origin_country: m.origin_country ?? m.production_countries?.map((c: any) => c.iso_3166_1) ?? [],
                genres: m.genre_ids
                    ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                    : [],
                type: 'tv',
            }));

            return shuffleArray(items).slice(0, minReq);
        } catch (err) {
            this.logger.error('Failed to fetch featured', err as any);
            return [];
        }
    }

    // ─── Trending ────────────────────────────────────────────────────────────────

    async getTrending(limit = 30, page?: number, skipCache = false): Promise<TvListResult> {
        if (!page && !skipCache) return this.cachedList(`tv:trending:${limit}`, () => this.getTrending(limit, page, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trending');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `/trending/tv/day?include_adult=false&page=${p}`,
                minReq,
                5,
                (results) =>
                    results.filter((m: any) => {
                        const date = new Date(m.release_date ?? m.first_air_date ?? '');
                        return date >= new Date(getRecentDate(365));
                    }),
            );

            const items: TmdbTv[] = uniqueItems.map((m: any) => ({
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
                    ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                    : [],
                type: 'tv',
                recommendations: [],
            }));

            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch trending', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Airing Today ────────────────────────────────────────────────────────────

    async airingToday(limit = 30, page?: number, skipCache = false): Promise<TvListResult> {
        if (!page && !skipCache) return this.cachedList(`tv:airingToday:${limit}`, () => this.airingToday(limit, page, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty airing today');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `/tv/airing_today?language=en-US&page=${p}`,
                minReq,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.map((m) => mapToTmdbTv(m, this.client.genreMap, true));
            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch airing today', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Airing This Week ────────────────────────────────────────────────────────

    async airingThisWeek(limit = 30, page?: number, skipCache = false): Promise<TvListResult> {
        if (!page && !skipCache) return this.cachedList(`tv:airingThisWeek:${limit}`, () => this.airingThisWeek(limit, page, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty airing this week');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `/tv/on_the_air?language=en-US&page=${p}`,
                minReq,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.map((m) => mapToTmdbTv(m, this.client.genreMap, true));
            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch airing this week', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Favorites ───────────────────────────────────────────────────────────────

    async getFavorites(limit = 30, page?: number, skipCache = false): Promise<TvListResult> {
        if (!page && !skipCache) return this.cachedList(`tv:favorites:${limit}`, () => this.getFavorites(limit, page, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `/trending/tv/day?page=${p}`,
                minReq,
                5,
                (results) =>
                    this.filterService.filterAdultishContent(
                        results.filter((item: any) => item.media_type === 'tv'),
                    ),
            );

            const items: TmdbTv[] = uniqueItems.map((m: any) => ({
                id: m.id,
                title: m.title ?? m.name ?? 'Untitled',
                overview: m.overview ?? '',
                genres: m.genre_ids
                    ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                    : [],
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date ?? m.first_air_date ?? null,
                vote_average: m.vote_average,
                type: 'tv',
            }));

            return this.returnOrPaginate(items, limit, page, false);
        } catch (err) {
            this.logger.error('Failed to fetch favorites', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Korea Trending ──────────────────────────────────────────────────────────

    async getKoreaTrending(limit = 30, page?: number, skipCache = false): Promise<TvListResult> {
        if (!page && !skipCache) return this.cachedList(`tv:koreaTrending:${limit}`, () => this.getKoreaTrending(limit, page, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `discover/tv?with_original_language=ko&sort_by=popularity.desc&page=${p}&include_adult=false&without_keywords=13090,190720`,
                minReq,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items: TmdbTv[] = uniqueItems.map((m) => ({
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
                genres: m.genre_ids?.map((id: number) => this.client.genreMap[id] || 'Unknown') ?? [],
                type: 'tv' as const,
                recommendations: [],
            }));

            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch koreaTrending', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Revenue ─────────────────────────────────────────────────────────────────

    async getRevenue(limit = 30, skipCache = false): Promise<TmdbTv[]> {
        if (!skipCache) return this.cachedList(`tv:revenue:${limit}`, () => this.getRevenue(limit, true));
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty revenue');
            return [];
        }

        try {
            const uniqueItems = await this.fetchPages(
                (p) => `/discover/tv?language=en-US&sort_by=revenue.desc&page=${p}`,
                minReq,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.slice(0, minReq).map((m) => mapToTmdbTv(m, this.client.genreMap, true));
            const shuffled = shuffleArray(items);
            this.recommendationsService.populateRecommendationsBackground(shuffled);
            return shuffled;
        } catch (err) {
            this.logger.error('Failed to fetch revenue TV', err as any);
            return [];
        }
    }

    // ─── TV by Genres ────────────────────────────────────────────────────────────

    async tvByGenres(ids: string, useAnd = false, limit = 30): Promise<TmdbTv[]> {
        const minReq = this.min(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty genre results');
            return [];
        }

        try {
            const genresParam = useAnd ? ids : ids.replace(/,/g, '|');
            const gteDate = new Date(new Date().getFullYear() - 5, 0, 1).toISOString().split('T')[0];

            const uniqueItems = await this.fetchPages(
                (p) =>
                    `/discover/tv?language=en-US&page=${p}` +
                    `&with_genres=${genresParam}` +
                    `&include_adult=false` +
                    `&include_null_first_air_dates=false` +
                    `&sort_by=first_air_date.desc` +
                    `&first_air_date.gte=${gteDate}` +
                    `&vote_count.gte=50`,
                minReq,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.slice(0, minReq).map((m) => mapToTmdbTv(m, this.client.genreMap, true));
            const shuffled = shuffleArray(items);
            this.recommendationsService.populateRecommendationsBackground(shuffled);
            return shuffled;
        } catch (err) {
            this.logger.error('Failed to fetch TV by genres', err as any);
            return [];
        }
    }
}
