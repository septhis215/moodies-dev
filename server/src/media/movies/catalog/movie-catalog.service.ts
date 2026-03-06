import { Injectable, Logger } from '@nestjs/common';
import { MovieTmdbClientService } from '../client/movie-tmdb-client.service';
import { MovieContentFilterService } from '../filters/movie-content-filter.service';
import { MovieRecommendationsService } from '../recommendations/movie-recommendations.service';
import { TmdbMovie, MovieListResult } from '../types/movie.types';
import { shuffleArray, getRecentDate, paginateItems, mapToTmdbMovie } from '../utils/helpers';

const MIN_REQUIRED_ITEMS = 25;

@Injectable()
export class MovieCatalogService {
    private readonly logger = new Logger(MovieCatalogService.name);

    constructor(
        private readonly client: MovieTmdbClientService,
        private readonly filterService: MovieContentFilterService,
        private readonly recommendationsService: MovieRecommendationsService,
    ) { }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private minRequired(limit: number) {
        return Math.max(MIN_REQUIRED_ITEMS, limit);
    }

    private emptyPaginated(page: number) {
        return { data: [], page, totalPages: 0, total: 0 };
    }

    private async fetchDiscoverPages(
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

    private returnOrPaginate(
        items: TmdbMovie[],
        limit: number,
        page?: number,
        withBackground = true,
    ): MovieListResult {
        const min = this.minRequired(limit);

        if (!page) {
            const slice = items.slice(0, min);
            if (withBackground) this.recommendationsService.populateRecommendationsBackground(slice);
            return slice;
        }

        const result = paginateItems(items, page, limit);
        if (withBackground) this.recommendationsService.populateRecommendationsBackground(result.data);
        return result;
    }

    // ─── Featured ───────────────────────────────────────────────────────────────

    async getFeatured(limit = 30, page?: number): Promise<MovieListResult> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty featured');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) => `discover/movie?sort_by=popularity.desc&include_adult=false&page=${p}&primary_release_date.gte=${getRecentDate(365)}&without_keywords=13090,190720`,
                min,
                page !== undefined ? 20 : 5,
            );

            const items = uniqueItems.map((m) => mapToTmdbMovie(m, this.client.genreMap));
            const sorted = page !== undefined ? items : shuffleArray(items);
            return this.returnOrPaginate(sorted, limit, page, false);
        } catch (err) {
            this.logger.error('Failed to fetch featured', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Trending ────────────────────────────────────────────────────────────────

    async getTrending(limit = 30, page?: number): Promise<MovieListResult> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trending');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) => `trending/movie/day?include_adult=false&page=${p}`,
                min,
                page !== undefined ? 20 : 5,
                (results) =>
                    results.filter((m: any) => {
                        const date = new Date(m.release_date ?? '');
                        return date >= new Date(getRecentDate(365));
                    }),
            );

            const items = uniqueItems.map((m) => mapToTmdbMovie(m, this.client.genreMap));
            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch trending', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Korea Trending ──────────────────────────────────────────────────────────

    async getKoreaTrending(limit = 30, page?: number): Promise<MovieListResult> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) => `discover/movie?with_original_language=ko&sort_by=popularity.desc&page=${p}&include_adult=false&without_keywords=13090,190720`,
                min,
                page !== undefined ? 20 : 5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items: TmdbMovie[] = uniqueItems.map((m) => ({
                ...mapToTmdbMovie(m, this.client.genreMap),
                type: 'movie' as const,
            }));

            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch koreaTrending', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Favorites ───────────────────────────────────────────────────────────────

    async getFavorites(limit = 30): Promise<TmdbMovie[]> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
            return [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) => `/trending/movie/day?page=${p}`,
                min,
                5,
                (results) =>
                    this.filterService.filterAdultishContent(
                        results.filter((item: any) => item.media_type === 'movie' || !item.media_type),
                    ),
            );

            const items: TmdbMovie[] = uniqueItems.map((m: any) => ({
                id: m.id,
                title: m.title ?? m.name ?? 'Untitled',
                overview: m.overview ?? '',
                genres: m.genre_ids
                    ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                    : [],
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date ?? null,
                vote_average: m.vote_average,
                type: 'movie' as const,
            }));

            return shuffleArray(items).slice(0, min);
        } catch (err) {
            this.logger.error('Failed to fetch favorites', err as any);
            return [];
        }
    }

    // ─── New Releases ────────────────────────────────────────────────────────────

    async getNewReleases(limit = 30, page?: number): Promise<MovieListResult> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty new releases');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const currentYear = new Date().getFullYear();
            const items: TmdbMovie[] = [];

            for (let currentPage = 1; currentPage <= 20 && items.length < min * 2; currentPage++) {
                try {
                    const data = await this.client.tmdb(
                        `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_year=${currentYear}&page=${currentPage}&include_adult=false`,
                    );
                    const results = (data?.results ?? []).filter(
                        (m: any) => m.id && (m.title || m.name) && m.poster_path && m.release_date,
                    );

                    items.push(
                        ...results.map((m: any) => ({
                            id: m.id,
                            title: m.title ?? 'Untitled',
                            overview: m.overview ?? '',
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: m.release_date,
                            vote_average: m.vote_average ?? 0,
                            vote_count: m.vote_count ?? 0,
                            popularity: m.popularity ?? 0,
                            origin_country: m.origin_country ?? [],
                            type: 'movie' as const,
                            recommendations: [],
                            genres: m.genre_ids
                                ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                                : [],
                        })),
                    );
                } catch (err) {
                    this.logger.warn(`Failed to fetch new releases page ${currentPage}`, err);
                }
            }

            const uniqueItems = Array.from(new Map(items.map((i) => [i.id, i])).values());
            const sorted = uniqueItems.sort(
                (a, b) =>
                    new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime(),
            );

            if (page !== undefined) return paginateItems(sorted, page, limit);
            return sorted.slice(0, limit);
        } catch (err) {
            this.logger.error('Failed to fetch new movie releases', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    // ─── Genre-based lists ────────────────────────────────────────────────────────

    private async getGenreMovies(
        genreId: number,
        extraParams: string,
        logName: string,
        limit = 30,
        page?: number,
    ): Promise<MovieListResult> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn(`TMDB_API_KEY not set; returning empty ${logName}`);
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) => `discover/movie?with_genres=${genreId}&sort_by=popularity.desc&page=${p}&include_adult=false${extraParams}`,
                min,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.map((m) => mapToTmdbMovie(m, this.client.genreMap));
            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error(`Failed to fetch ${logName}`, err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }

    async getActionMovies(limit = 30, page?: number): Promise<MovieListResult> {
        return this.getGenreMovies(28, '&vote_count.gte=500', 'actionMovies', limit, page);
    }

    async getAnimatedMovies(limit = 30, page?: number): Promise<MovieListResult> {
        return this.getGenreMovies(16, '&vote_count.gte=300', 'animatedMovies', limit, page);
    }

    async getIndieMovies(limit = 30, page?: number): Promise<MovieListResult> {
        return this.getGenreMovies(
            18,
            '&sort_by=vote_average.desc&vote_count.gte=100&vote_count.lte=5000&vote_average.gte=7.0',
            'indieMovies',
            limit,
            page,
        );
    }

    async getDocumentaryMovies(limit = 25): Promise<TmdbMovie[]> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty documentaryMovies');
            return [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) =>
                    `discover/movie?with_genres=99&sort_by=vote_average.desc&page=${p}&include_adult=false&vote_count.gte=200`,
                min,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.slice(0, min).map((m) => mapToTmdbMovie(m, this.client.genreMap));
            const shuffled = shuffleArray(items);
            this.recommendationsService.populateRecommendationsBackground(shuffled);
            return shuffled;
        } catch (err) {
            this.logger.error('Failed to fetch documentaryMovies', err as any);
            return [];
        }
    }

    async getAwardWinners(limit = 30, page?: number): Promise<MovieListResult> {
        const min = this.minRequired(limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty awardWinners');
            return page ? this.emptyPaginated(1) : [];
        }

        try {
            const uniqueItems = await this.fetchDiscoverPages(
                (p) =>
                    `discover/movie?sort_by=vote_average.desc&page=${p}&include_adult=false&vote_count.gte=700&vote_average.gte=7.0`,
                min,
                5,
                (results) => this.filterService.filterAdultishContent(results),
            );

            const items = uniqueItems.map((m) => mapToTmdbMovie(m, this.client.genreMap));
            return this.returnOrPaginate(items, limit, page);
        } catch (err) {
            this.logger.error('Failed to fetch awardWinners', err as any);
            return page ? this.emptyPaginated(1) : [];
        }
    }
}