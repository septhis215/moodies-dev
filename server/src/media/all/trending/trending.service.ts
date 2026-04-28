import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { ContentFilterService } from '../filters/content-filter.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { PrismaService } from 'src/prisma/prisma.service';
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
        private readonly prismaService: PrismaService,
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

    async getFavorites(userId: string, limit = 30): Promise<TmdbAll[]> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
            return [];
        }

        // Check cache first
        const cacheKey = `personalized-favorites-${userId}-${limit}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return (JSON.parse(cached) as TmdbAll[]).slice(0, limit);
            } catch { }
        }

        try {
            // Fetch user preferences
            const user = await this.prismaService.user.findUnique({
                where: { id: userId },
                select: {
                    preferredGenres: true,
                    preferredLanguages: true,
                    age: true,
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Validate that user has set preferences
            if (!user.preferredGenres || user.preferredGenres.length === 0 ||
                !user.preferredLanguages || user.preferredLanguages.length === 0) {
                throw new BadRequestException(
                    'Please complete your profile preferences (genres and languages) to get personalized recommendations.'
                );
            }

            // Convert genre names to TMDB genre IDs
            const genreNameToId = this.createGenreNameToIdMap();
            const genreIds = user.preferredGenres
                .slice(0, 3)
                .map(name => genreNameToId[name])
                .filter(id => id !== undefined);

            if (genreIds.length === 0) {
                this.logger.warn(`No valid genres found for user ${userId}`);
                return [];
            }

            // Convert language names to TMDB language codes
            const languageNameToCode = {
                'English': 'en',
                'Korean': 'ko',
                'Spanish': 'es',
                'French': 'fr',
                'German': 'de',
                'Japanese': 'ja',
                'Chinese': 'zh',
                'Russian': 'ru',
                'Italian': 'it',
                'Portuguese': 'pt',
                'Hindi': 'hi',
                'Thai': 'th',
                'Vietnamese': 'vi',
                'Turkish': 'tr',
                'Polish': 'pl',
            };

            const primaryLanguage = languageNameToCode[user.preferredLanguages[0]] || 'en';

            const collected: TmdbAll[] = [];
            const seenIds = new Set<number>();
            const MAX_PAGES = 5;

            // Phase 1: Discover by genres + languages
            const genreQueryStr = genreIds.join(',');

            const fetchDiscoverPages = async (urlBase: string, mediaType: 'movie' | 'tv') => {
                for (let page = 1; page <= MAX_PAGES && collected.length < limit * 2; page++) {
                    try {
                        const data = await this.client.tmdb(urlBase + `&page=${page}`);
                        const results = data?.results ?? [];
                        if (!results.length) break;

                        const filtered = results.filter(
                            (item: any) => item.media_type === mediaType || (mediaType === 'movie' ? !item.first_air_date : !item.release_date)
                        );

                        const clean = this.filterService.filterAdultishContent(filtered);

                        for (const item of clean) {
                            if (!seenIds.has(item.id)) {
                                const mapped: TmdbAll = {
                                    id: item.id,
                                    title: item.title ?? item.name ?? 'Untitled',
                                    overview: item.overview ?? '',
                                    genres: item.genre_ids
                                        ? item.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                                        : [],
                                    poster_path: item.poster_path ?? null,
                                    backdrop_path: item.backdrop_path ?? null,
                                    release_date: item.release_date ?? item.first_air_date ?? null,
                                    vote_average: item.vote_average,
                                    vote_count: item.vote_count,
                                    popularity: item.popularity,
                                    type: mediaType,
                                };
                                collected.push(mapped);
                                seenIds.add(item.id);
                            }
                        }

                        if (data.total_pages && page >= data.total_pages) break;
                    } catch (e) {
                        this.logger.debug(`Failed fetching page ${page}`, e);
                        break;
                    }
                }
            };

            // Discover TV with preferences (genre IDs + language code)
            const tvUrl = `${this.client.baseUrl}/discover/tv?with_genres=${genreQueryStr}&with_original_language=${primaryLanguage}&sort_by=popularity.desc&include_adult=false`;
            // Discover Movies with preferences (genre IDs + language code)
            const movieUrl = `${this.client.baseUrl}/discover/movie?with_genres=${genreQueryStr}&with_original_language=${primaryLanguage}&sort_by=popularity.desc&include_adult=false`;

            await Promise.all([
                fetchDiscoverPages(tvUrl, 'tv'),
                fetchDiscoverPages(movieUrl, 'movie'),
            ]);

            // Phase 2: Fetch smart recommendations for top items to fill gaps
            if (collected.length < limit) {
                const topItems = collected.slice(0, Math.ceil(limit / 3));
                const recTasks = topItems.map(item => async () => {
                    try {
                        const recs = await this.recommendationsService.getSmartRecommendations(
                            item.type as 'movie' | 'tv',
                            item.id,
                            3
                        );
                        return recs;
                    } catch {
                        return [];
                    }
                });

                const recResults = await this.client.withConcurrencyLimit(recTasks, 2);
                for (const recList of recResults) {
                    for (const rec of recList) {
                        if (!seenIds.has(rec.id) && collected.length < limit * 1.5) {
                            collected.push(rec);
                            seenIds.add(rec.id);
                        }
                    }
                }
            }

            if (collected.length === 0) {
                this.logger.warn(`No favorites found for user ${userId} with preferences`);
                return [];
            }

            const shuffled = shuffleArray(collected);
            const sliced = shuffled.slice(0, Math.max(limit, 25));

            await this.redisService.set(cacheKey, JSON.stringify(sliced), CACHE_TTL.BASIC_DATA);
            return sliced;
        } catch (err) {
            if (err instanceof BadRequestException) {
                throw err;
            }
            this.logger.error(`Failed to fetch personalized favorites for user ${userId}`, err as any);
            return [];
        }
    }

    /**
     * Creates a reverse mapping from genre names to TMDB genre IDs
     * Uses the existing genreMap (ID -> Name) to build Name -> ID
     */
    private createGenreNameToIdMap(): Record<string, number> {
        const map: Record<string, number> = {};
        for (const [id, name] of Object.entries(this.client.genreMap)) {
            map[name] = Number(id);
        }
        return map;
    }

    async trending(type: string) {
        const data = await this.client.tmdb(`trending/all/${type}`);
        return data?.results ?? [];
    }
}