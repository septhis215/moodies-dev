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

        // const cacheKey = `personalized-favorites-v2-${userId}-${limit}`;
        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     try {
        //         return (JSON.parse(cached) as TmdbAll[]).slice(0, limit);
        //     } catch { }
        // }

        try {
            const user = await this.prismaService.user.findUnique({
                where: { id: userId },
                select: {
                    preferredGenres: true,
                    preferredLanguages: true,
                    age: true,
                },
            });

            if (!user) throw new Error('User not found');

            if (
                !user.preferredGenres || user.preferredGenres.length === 0 ||
                !user.preferredLanguages || user.preferredLanguages.length === 0
            ) {
                throw new BadRequestException(
                    'Please complete your profile preferences (genres and languages) to get personalized recommendations.'
                );
            }

            // ─── Genre + Language Resolution ───
            const genreNameToId = this.createGenreNameToIdMap();
            const genreIds = user.preferredGenres
                .slice(0, 3)
                .map(name => genreNameToId[name])
                .filter((id): id is number => id !== undefined);

            if (genreIds.length === 0) {
                this.logger.warn(`No valid genres found for user ${userId}`);
                return [];
            }

            const languageNameToCode: Record<string, string> = {
                English: 'en', Korean: 'ko', Spanish: 'es', French: 'fr',
                German: 'de', Japanese: 'ja', Chinese: 'zh', Russian: 'ru',
                Italian: 'it', Portuguese: 'pt', Hindi: 'hi', Thai: 'th',
                Vietnamese: 'vi', Turkish: 'tr', Polish: 'pl',
            };

            // Support up to 2 preferred languages for wider discovery
            const preferredLangCodes = user.preferredLanguages
                .slice(0, 2)
                .map(l => languageNameToCode[l])
                .filter(Boolean);
            const primaryLang = preferredLangCodes[0] ?? 'en';
            const secondaryLang = preferredLangCodes[1] ?? null;

            // ─── Scoring Helpers ────
            const currentYear = new Date().getFullYear();

            /**
             * Composite relevance score combining:
             *  - Vote average (quality signal, normalised 0–1)
             *  - TMDB popularity (editorial trending signal)
             *  - Recency      (favour content released in last 3 years)
             *  - Genre overlap (how many preferred genres match)
             *  - Language match (whether item's language matches preferred languages)
             *
             * Weights are tuned to prioritize genre and language equally.
             * Note: Vote count confidence is removed to avoid filtering out titles
             * without many votes but high quality content.
             */
            const scoreItem = (item: TmdbAll, itemGenreIds: number[], itemOriginalLanguage: string): number => {
                const qualityScore = (item.vote_average ?? 0) / 10;          // 0–1
                const popularityScore = Math.min((item.popularity ?? 0) / 500, 1);               // 0–1

                const releaseYear = item.release_date
                    ? new Date(item.release_date).getFullYear()
                    : currentYear - 5;
                const age = Math.max(currentYear - releaseYear, 0);
                const recencyScore = age <= 1 ? 1 : age <= 3 ? 0.8 : age <= 6 ? 0.5 : 0.2;

                const genreOverlap = itemGenreIds.filter(id => genreIds.includes(id)).length;
                const genreScore = Math.min(genreOverlap / genreIds.length, 1);

                // Language score: prioritize items matching preferred languages
                const languageScore = preferredLangCodes.includes(itemOriginalLanguage) ? 1 : 0;

                return (
                    qualityScore * 0.15 +
                    popularityScore * 0.10 +
                    recencyScore * 0.10 +
                    genreScore * 0.30 +
                    languageScore * 0.35
                );
            };

            // ─── Fetch Strategy ───
            // We fetch from 4 independent pools per media type to maximise signal diversity:
            //   1. Genre + primary language discover (most personalised)
            //   2. Genre-only discover (catches popular titles in other languages)
            //   3. Top-rated endpoint (quality floor)
            //   4. Trending weekly (freshness signal)
            // Each pool targets `limit` items so we have enough to rank against.

            interface RawItem {
                id: number;
                title?: string;
                name?: string;
                overview?: string;
                genre_ids?: number[];
                poster_path?: string | null;
                backdrop_path?: string | null;
                release_date?: string;
                first_air_date?: string;
                vote_average?: number;
                vote_count?: number;
                popularity?: number;
                media_type?: string;
                original_language?: string;
            }

            const MAX_PAGES = 4; // per endpoint — keeps latency reasonable
            const seenIds = new Set<number>();

            // Scored intermediate store before splitting by type
            const scoredMovies: Array<TmdbAll & { _score: number }> = [];
            const scoredTv: Array<TmdbAll & { _score: number }> = [];

            const pushItem = (raw: RawItem, mediaType: 'movie' | 'tv') => {
                if (seenIds.has(raw.id)) return;
                seenIds.add(raw.id);

                const mapped: TmdbAll = {
                    id: raw.id,
                    title: raw.title ?? raw.name ?? 'Untitled',
                    overview: raw.overview ?? '',
                    genres: (raw.genre_ids ?? []).map((id: number) => this.client.genreMap[id] ?? 'Unknown'),
                    poster_path: raw.poster_path ?? null,
                    backdrop_path: raw.backdrop_path ?? null,
                    release_date: raw.release_date ?? raw.first_air_date ?? null,
                    vote_average: raw.vote_average ?? 0,
                    vote_count: raw.vote_count ?? 0,
                    popularity: raw.popularity ?? 0,
                    type: mediaType,
                    original_language: raw.original_language ?? 'en',
                };

                const scored = { ...mapped, _score: scoreItem(mapped, raw.genre_ids ?? [], raw.original_language ?? 'en') };
                if (mediaType === 'movie') scoredMovies.push(scored);
                else scoredTv.push(scored);
            };

            // Helper: fetch paginated discover/list endpoint
            const fetchPages = async (
                baseUrl: string,
                mediaType: 'movie' | 'tv',
                maxPages = MAX_PAGES,
                targetCount = limit,
            ) => {
                for (let page = 1; page <= maxPages; page++) {
                    const pool = mediaType === 'movie' ? scoredMovies : scoredTv;
                    if (pool.length >= targetCount * 2) break;
                    try {
                        const data = await this.client.tmdb(`${baseUrl}&page=${page}`);
                        const results: RawItem[] = data?.results ?? [];
                        if (!results.length) break;

                        // Minimum quality gate: skip very low-rated items (< 5.0) with enough votes
                        const qualified = results.filter(
                            r => !(r.vote_count && r.vote_count > 50 && (r.vote_average ?? 0) < 5.0)
                        );
                        const clean = this.filterService.filterAdultishContent(qualified);
                        clean.forEach(r => pushItem(r, mediaType));

                        if (data.total_pages && page >= data.total_pages) break;
                    } catch (e) {
                        this.logger.debug(`Failed fetching page ${page} of ${baseUrl}`, e);
                        break;
                    }
                }
            };

            const genreStr = genreIds.join(',');
            const base = this.client.baseUrl;
            const adultParam = 'include_adult=false';

            // Build URL sets for both languages (primary is always included)
            const langUrls = (type: 'movie' | 'tv', extraParams = '') => {
                const endpoint = type === 'movie' ? 'movie' : 'tv';
                const langKey = type === 'movie' ? 'with_original_language' : 'with_original_language';
                const urls: string[] = [
                    // Pool 1 – genre + primary language, sorted by popularity
                    `${base}/discover/${endpoint}?with_genres=${genreStr}&${langKey}=${primaryLang}&sort_by=popularity.desc&${adultParam}${extraParams}`,
                    // Pool 2 – genre only, sorted by popularity (catches non-primary-lang hits)
                    `${base}/discover/${endpoint}?with_genres=${genreStr}&sort_by=popularity.desc&${adultParam}${extraParams}`,
                    // Pool 3 – genre + primary language, sorted by vote average (quality focus)
                    `${base}/discover/${endpoint}?with_genres=${genreStr}&${langKey}=${primaryLang}&sort_by=vote_average.desc&vote_count.gte=200&${adultParam}${extraParams}`,
                    // Pool 4 – genre only, sorted by release date (freshness focus)
                    `${base}/discover/${endpoint}?with_genres=${genreStr}&sort_by=primary_release_date.desc&vote_count.gte=50&${adultParam}${extraParams}`,
                ];
                if (secondaryLang) {
                    urls.push(
                        `${base}/discover/${endpoint}?with_genres=${genreStr}&${langKey}=${secondaryLang}&sort_by=popularity.desc&${adultParam}${extraParams}`
                    );
                }
                return urls;
            };

            // Pool 5 – trending weekly (real-time freshness, not genre-filtered)
            const trendingMovieUrl = `${base}/trending/movie/week?${adultParam}`;
            const trendingTvUrl = `${base}/trending/tv/week?${adultParam}`;
            // Pool 6 – top-rated (all-time quality floor)
            const topRatedMovieUrl = `${base}/movie/top_rated?language=${primaryLang}&${adultParam}`;
            const topRatedTvUrl = `${base}/tv/top_rated?language=${primaryLang}&${adultParam}`;

            // Run all pools concurrently (6 movie + 6 TV streams)
            const movieFetches = [
                ...langUrls('movie').map(url => fetchPages(url, 'movie')),
                fetchPages(trendingMovieUrl, 'movie', 2),
                fetchPages(topRatedMovieUrl, 'movie', 2),
            ];
            const tvFetches = [
                ...langUrls('tv').map(url => fetchPages(url, 'tv')),
                fetchPages(trendingTvUrl, 'tv', 2),
                fetchPages(topRatedTvUrl, 'tv', 2),
            ];

            await Promise.all([...movieFetches, ...tvFetches]);

            // ─── Phase 2: Smart Recommendations Gap-fill ─────────────────────────────
            // Only triggered when either bucket is thin; uses top-scored seeds.
            const HALF = Math.ceil(limit / 2);

            const maybeGapFill = async (
                pool: Array<TmdbAll & { _score: number }>,
                mediaType: 'movie' | 'tv',
            ) => {
                if (pool.length >= HALF) return;
                const seeds = pool.slice(0, 5); // top-5 by insertion order (already quality-gated)
                const tasks = seeds.map(seed => async () => {
                    try {
                        return await this.recommendationsService.getSmartRecommendations(
                            mediaType, seed.id, 5
                        );
                    } catch {
                        return [];
                    }
                });
                const results = await this.client.withConcurrencyLimit(tasks, 2);
                for (const list of results) {
                    for (const rec of list) {
                        pushItem(rec as RawItem, mediaType);
                    }
                }
            };

            await Promise.all([
                maybeGapFill(scoredMovies, 'movie'),
                maybeGapFill(scoredTv, 'tv'),
            ]);

            // ─── Ranking & Balanced Merge ───
            // Sort each bucket by composite score descending
            scoredMovies.sort((a, b) => b._score - a._score);
            scoredTv.sort((a, b) => b._score - a._score);

            // ─── Phase 3a: Dynamic Movie/TV Balancing ─────────────────────────────
            // Ensure proportional representation: aim for 45-55% split per type
            // This guarantees users see a healthy mix of both movies and series

            const MIN_TYPE_PERCENTAGE = 0.40;  // Minimum 40% of one type
            const MAX_TYPE_PERCENTAGE = 0.60;  // Maximum 60% of one type

            // Calculate available items from each type
            const totalAvailable = scoredMovies.length + scoredTv.length;

            let finalMovies: Array<TmdbAll & { _score: number }>;
            let finalTv: Array<TmdbAll & { _score: number }>;

            if (scoredMovies.length === 0) {
                // Only TV available
                finalMovies = [];
                finalTv = scoredTv.slice(0, limit);
            } else if (scoredTv.length === 0) {
                // Only movies available
                finalMovies = scoredMovies.slice(0, limit);
                finalTv = [];
            } else {
                // Both types available: ensure balanced split
                const minMovies = Math.floor(limit * MIN_TYPE_PERCENTAGE);
                const maxMovies = Math.ceil(limit * MAX_TYPE_PERCENTAGE);
                const minTv = Math.floor(limit * MIN_TYPE_PERCENTAGE);
                const maxTv = Math.ceil(limit * MAX_TYPE_PERCENTAGE);

                let movieCount = Math.ceil(limit / 2);
                let tvCount = Math.floor(limit / 2);

                // Adjust if one type has insufficient content
                if (scoredMovies.length < movieCount) {
                    movieCount = Math.min(scoredMovies.length, maxMovies);
                    tvCount = Math.min(limit - movieCount, scoredTv.length);
                } else if (scoredTv.length < tvCount) {
                    tvCount = Math.min(scoredTv.length, maxTv);
                    movieCount = Math.min(limit - tvCount, scoredMovies.length);
                }

                // Enforce minimum representation from each type
                if (movieCount < minMovies && scoredMovies.length >= minMovies) {
                    movieCount = minMovies;
                    tvCount = Math.min(limit - movieCount, scoredTv.length);
                }
                if (tvCount < minTv && scoredTv.length >= minTv) {
                    tvCount = minTv;
                    movieCount = Math.min(limit - tvCount, scoredMovies.length);
                }

                finalMovies = scoredMovies.slice(0, movieCount);
                finalTv = scoredTv.slice(0, tvCount);
            }

            if (finalMovies.length === 0 && finalTv.length === 0) {
                this.logger.warn(`No favorites found for user ${userId} with preferences`);
                return [];
            }

            // Interleave movies and TV so the feed feels varied (not all movies then all TV)
            const interleaved: TmdbAll[] = [];
            const mLen = finalMovies.length;
            const tLen = finalTv.length;
            const maxLen = Math.max(mLen, tLen);
            for (let i = 0; i < maxLen; i++) {
                if (i < mLen) interleaved.push(finalMovies[i]);
                if (i < tLen) interleaved.push(finalTv[i]);
            }

            let result = interleaved.slice(0, limit);

            // ─── Phase 3b: Language Diversity Assurance ─────────────────────────────
            // Ensure representation from secondary languages if available
            if (secondaryLang && preferredLangCodes.length > 1) {
                const secondaryLangCode = preferredLangCodes[1];
                const secondaryItems = interleaved.filter(
                    item => (item as any).original_language === secondaryLangCode
                );

                // Guarantee 1-3 items from secondary language if available
                const minSecondaryItems = Math.min(3, Math.max(1, Math.floor(limit * 0.15)));
                const currentSecondaryCount = result.filter(
                    item => (item as any).original_language === secondaryLangCode
                ).length;

                if (currentSecondaryCount < minSecondaryItems && secondaryItems.length > currentSecondaryCount) {
                    // Replace lowest-scored items with secondary language items
                    const neededCount = Math.min(minSecondaryItems - currentSecondaryCount, secondaryItems.length);
                    const availableSecondary = secondaryItems.filter(
                        s => !result.includes(s)
                    ).slice(0, neededCount);

                    if (availableSecondary.length > 0) {
                        // Remove items with lowest scores to make room
                        result = result
                            .slice(0, result.length - availableSecondary.length)
                            .concat(availableSecondary)
                            .slice(0, limit);
                    }
                }
            }

            // await this.redisService.set(cacheKey, JSON.stringify(result), CACHE_TTL.BASIC_DATA);
            return result;

        } catch (err) {
            if (err instanceof BadRequestException) throw err;
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