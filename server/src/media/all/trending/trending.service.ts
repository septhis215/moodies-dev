import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { ContentFilterService } from '../filters/content-filter.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { TmdbAll } from '../types/tmdb.types';
import { CACHE_TTL, shuffleArray, getRecentDate } from '../utils/helpers';

@Injectable()
export class TrendingService {
    private readonly logger = new Logger(TrendingService.name);

    constructor(
        private readonly client: TmdbClientService,
        private readonly redisService: RedisService,
        private readonly filterService: ContentFilterService,
        private readonly recommendationsService: RecommendationsService,
    ) { }

    async getFeatured(limit = 30): Promise<TmdbAll[]> {
        const cacheKey = `featured`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return (JSON.parse(cached) as TmdbAll[]).slice(0, limit);
            } catch { }
        }

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty featured');
            return [];
        }

        try {
            const [movies, tv] = await Promise.all([
                this.client.tmdb(
                    `/discover/movie?sort_by=popularity.desc&include_adult=false&page=1
                &primary_release_date.gte=${getRecentDate(60)} 
                &without_keywords=13090,190720`
                ),
                this.client.tmdb(
                    `/discover/tv?sort_by=popularity.desc&include_adult=false&page=1
                &first_air_date.gte=${getRecentDate(60)} 
                &without_keywords=13090,190720`
                ),
            ]);

            const results = [...(movies?.results ?? []), ...(tv?.results ?? [])];
            const uniqueItems = Array.from(
                new Map(results.map((item) => [item.id, item])).values()
            );

            const all: TmdbAll[] = uniqueItems.map((m: any) => ({
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
                genres: m.genre_ids ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown') : [],
                type: m.media_type ?? (m.title ? 'movie' : 'tv'),
            }));

            const shuffled = shuffleArray(all);
            const sliced = shuffled.slice(0, Math.max(0, limit));

            await this.redisService.set(cacheKey, JSON.stringify(sliced), CACHE_TTL.BASIC_DATA);
            return sliced;
        } catch (err) {
            this.logger.error('Failed to fetch featured', err as any);
            return [];
        }
    }

    async getTrending(limit = 30): Promise<TmdbAll[]> {
        const cacheKey = `trending-${limit}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return (JSON.parse(cached) as TmdbAll[]).slice(0, limit);
            } catch { }
        }

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trending');
            return [];
        }

        try {
            const data = await this.client.tmdb(`/trending/all/day?include_adult=false`);
            const results = (data?.results ?? []).filter((m: any) => {
                const date = new Date(m.release_date ?? m.first_air_date ?? '');
                return date >= new Date(getRecentDate(365));
            });

            const uniqueItems = Array.from(
                new Map(results.map((item) => [item.id, item])).values()
            );

            let basicItems: TmdbAll[] = uniqueItems.slice(0, limit).map((m: any) => ({
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
                        this.client.tmdb(`/movie/${movie.id}?language=en-US`).catch(() => null)
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

            const shuffled = shuffleArray(basicItems);
            await this.redisService.set(cacheKey, JSON.stringify(shuffled), CACHE_TTL.BASIC_DATA);

            this.recommendationsService.populateRecommendationsBackground(basicItems, cacheKey);

            return shuffled.slice(0, limit);
        } catch (err) {
            this.logger.error('Failed to fetch trending', err as any);
            return [];
        }
    }

    async getKoreaTrending(limit = 30): Promise<TmdbAll[]> {
        const cacheKey = `koreaTrending-${limit}`;

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
            return [];
        }

        try {
            const cached = await this.redisService.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as TmdbAll[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.slice(0, limit);
                }
            }
        } catch (e) {
            this.logger.debug('Failed to read koreaTrending cache', e);
        }

        const today = new Date().toISOString().split('T')[0];
        const recentDate = getRecentDate(90);

        try {
            const maxPages = 3;
            const collected: any[] = [];

            const fetchPages = async (urlBase: string) => {
                for (let page = 1; page <= maxPages; page++) {
                    try {
                        const data = await this.client.tmdb(`${urlBase}&page=${page}`);
                        const results = data?.results ?? [];
                        if (!results.length) break;

                        results.forEach(r => {
                            const release = r.release_date ?? r.first_air_date;
                            if (!release || release < recentDate || release > today) return;
                            collected.push(r);
                        });

                        if (data.total_pages && page >= data.total_pages) break;
                    } catch (e) {
                        this.logger.debug(`Failed fetching page ${page} for ${urlBase}`, e);
                        break;
                    }
                }
            };

            const tvBase = `${this.client.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&first_air_date.gte=${recentDate}&first_air_date.lte=${today}&include_adult=false&without_keywords=13090,190720&certification.lte=15`;
            const movieBase = `${this.client.baseUrl}/discover/movie?with_original_language=ko&sort_by=popularity.desc&primary_release_date.gte=${recentDate}&primary_release_date.lte=${today}&include_adult=false&without_keywords=13090,190720&certification.lte=15`;

            await Promise.all([fetchPages(tvBase), fetchPages(movieBase)]);

            const uniqueMap = new Map<number, any>();
            collected.forEach(item => {
                if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
            });
            const uniqueItems = Array.from(uniqueMap.values());

            uniqueItems.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

            const items: TmdbAll[] = uniqueItems.slice(0, limit).map(m => {
                const type = m.media_type ?? (m.first_air_date ? 'tv' : 'movie');
                return {
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
                    type,
                    recommendations: [],
                } as TmdbAll;
            });

            try { await this.redisService.set(cacheKey, JSON.stringify(items), CACHE_TTL.BASIC_DATA); } catch { }
            this.recommendationsService.populateRecommendationsBackground(items, cacheKey);

            return items;
        } catch (err) {
            this.logger.error('Failed to fetch koreaTrending', err as any);
            return [];
        }
    }

    async getFavorites(limit = 30): Promise<TmdbAll[]> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
            return [];
        }

        try {
            const MIN_RESULTS = 25;
            const MAX_PAGES = 5;
            let collected: TmdbAll[] = [];

            for (let page = 1; page <= MAX_PAGES && collected.length < limit; page++) {
                const data = await this.client.tmdb(`/trending/all/day?page=${page}`);
                const results = data?.results ?? [];

                const filtered = results.filter(
                    (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
                );

                const clean = this.filterService.filterAdultishContent(filtered);
                const uniqueItems = Array.from(
                    new Map(clean.map((item) => [item.id, item])).values()
                );

                const mapped: TmdbAll[] = uniqueItems.map((m: any) => ({
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
                    type: m.media_type,
                }));

                collected.push(...mapped);
            }

            if (collected.length < MIN_RESULTS) {
                this.logger.warn(
                    `Only ${collected.length} favorites collected, less than the minimum ${MIN_RESULTS}`
                );
            }

            const shuffled = shuffleArray(collected);
            return shuffled.slice(0, Math.max(MIN_RESULTS, limit));
        } catch (err) {
            this.logger.error('Failed to fetch favorites', err as any);
            return [];
        }
    }

    async trending(type: string) {
        const data = await this.client.tmdb(`trending/all/${type}`);
        return data?.results ?? [];
    }
}