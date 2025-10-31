import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';

// import { RedisService } from 'src/redis/redis.service';

export type TmdbAll = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string | null;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    original_language?: string;
    recommendations?: TmdbAll[];
    type?: 'movie' | 'tv';
    trailer_key?: string | null;
    network?: string; // for tv
    created_by?: string; // for tv
    genre_ids?: number[]; // for internal use
    runtime?: number; // for movie
};

export type TmdbPerson = {
    id: number;
    name: string;
    known_for_department?: string;
    profile_path: string | null;
    popularity: number;
    known_for?: {
        id: number;
        title?: string;
        name?: string;
        media_type: 'movie' | 'tv';
        poster_path: string | null;
        overview?: string;
    }[];
};
export type TrendingTerm = {
    id: number;
    title: string;
    media_type: string; // "movie" | "tv" | "person" | etc.
};
function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// strong disqualifier regex (word boundaries, allow hyphen/space variants)
const DISQUALIFY_RE = /\b(red[-\s]?band|uncut|uncensored|nsfw|explicit|age[-\s]?restricted|18\+|adult|mature|tv[-\s]?ma|redband)\b/i;


@Injectable()
export class AllService implements OnModuleInit {
    private readonly logger = new Logger(AllService.name);
    private readonly baseUrl: string;
    private readonly token: string;
    private genreMap: Record<number, string> = {};
    private readonly maxConcurrentRequests = 5; // TMDB rate limit consideration

    // Cache TTL constants
    private readonly CACHE_TTL = {
        BASIC_DATA: 60 * 60 * 24,      // 5 minutes for trending
        RECOMMENDATIONS: 60 * 60 * 24, // 30 minutes for recommendations
        TRAILERS: 60 * 60 * 24,       // 1 hour for trailers
        GENRES: 60 * 60 * 48     // 24 hours for genres
    };

    constructor(
        private readonly httpService: HttpService,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl =
            this.configService.get<string>('TMDB_BASE') ??
            'https://api.themoviedb.org/3';
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    // Concurrency control helper
    private async withConcurrencyLimit<T>(
        tasks: (() => Promise<T>)[],
        limit: number = this.maxConcurrentRequests
    ): Promise<T[]> {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += limit) {
            const batch = tasks.slice(i, i + limit);
            const batchResults = await Promise.allSettled(batch.map(task => task()));

            // Fix: Use proper type assertion
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
            }
        }
        return results;
    }

    // Generic helper: returns response.data (not only results)
    private async tmdb(endpoint: string) {
        // Normalize baseUrl + endpoint to avoid double-slashes
        const base = this.baseUrl.replace(/\/+$/, '');       // remove trailing slashes
        const path = endpoint.startsWith('http')
            ? endpoint
            : `${base}/${endpoint.replace(/^\/+/, '')}`;      // remove leading slashes from endpoint

        try {
            const response = await firstValueFrom(
                this.httpService.get(path, {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        Accept: 'application/json',
                    },
                })
            );

            return response.data;
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 404) {
                // Resource not found — return null so callers can skip this item
                this.logger.warn(`TMDB 404: ${path}`);
                return null;
            }
            if (status === 429) {
                this.logger.warn(`TMDB rate limited (429) on ${path}`);
                // optionally implement a short retry/backoff here
                return null;
            }
            // Log and rethrow unexpected errors so higher-level handler can decide
            this.logger.error(`TMDB request failed: ${path}`, err);
            throw err;
        }
    }


    // === Genres loader (in-memory map) ===
    async loadGenres() {
        if (!this.token) {
            this.logger.warn('TMDB token not set; skipping loadGenres');
            return;
        }

        try {
            const endpoints = ['/genre/movie/list', '/genre/tv/list'];
            for (const ep of endpoints) {
                const data = await this.tmdb(ep);
                const genres = data?.genres ?? [];
                for (const g of genres) {
                    this.genreMap[g.id] = g.name;
                }
            }
            this.logger.log(`Loaded genres: ${Object.keys(this.genreMap).length}`);
        } catch (err) {
            this.logger.error('Failed to load genres', err as any);
        }
    }

    async onModuleInit() {
        // populate genre map early
        await this.loadGenres();
    }

    // Featured (recent + trending, small cache)
    async getFeatured(limit = 30): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.BASIC_DATA;
        // const cacheKey = `featured`;
        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     try {
        //         return (JSON.parse(cached) as TmdbAll[]).slice(0, limit);
        //     } catch { }
        // }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty featured');
            return [];
        }

        try {
            // Pull from both TV + Movies with recent filters
            const [movies, tv] = await Promise.all([
                this.tmdb(
                    `/discover/movie?sort_by=popularity.desc&include_adult=false&page=1
                &primary_release_date.gte=${this.getRecentDate(365)} 
                &without_keywords=13090,190720`
                ),
                this.tmdb(
                    `/discover/tv?sort_by=popularity.desc&include_adult=false&page=1
                &first_air_date.gte=${this.getRecentDate(365)} 
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
                genres: m.genre_ids ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown') : [],
                type: m.media_type ?? (m.title ? 'movie' : 'tv'),
            }));

            const shuffled = shuffleArray(all);
            const sliced = shuffled.slice(0, Math.max(0, limit));

            // await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
            return sliced;
        } catch (err) {
            this.logger.error('Failed to fetch featured', err as any);
            return [];
        }
    }

    // Trending (optimized + recent + background recommendations)
    async getTrending(limit = 30): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.BASIC_DATA;
        const cacheKey = `trending-${limit}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return (JSON.parse(cached) as TmdbAll[]).slice(0, limit);
            } catch { }
        }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trending');
            return [];
        }

        try {
            const data = await this.tmdb(`/trending/all/day?include_adult=false`);
            const results = (data?.results ?? []).filter((m: any) => {
                const date = new Date(m.release_date ?? m.first_air_date ?? '');
                return date >= new Date(this.getRecentDate(365));
            });

            const uniqueItems = Array.from(
                new Map(results.map((item) => [item.id, item])).values()
            );

            // Pre-format basic data
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
                    ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
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
                        this.tmdb(`/movie/${movie.id}?language=en-US`).catch(() => null)
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
            await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);

            // Populate recommendations in background
            this.populateRecommendationsBackground(basicItems, cacheKey);

            return shuffled.slice(0, limit);
        } catch (err) {
            this.logger.error('Failed to fetch trending', err as any);
            return [];
        }
    }


    // Utility to get date X days ago
    private getRecentDate(days: number): string {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    }

    // Background recommendation population
    private async populateRecommendationsBackground(items: TmdbAll[], cacheKey: string) {
        setTimeout(async () => {
            const tasks = items.map(item => async () => {
                try {
                    const recs = await this.getSmartRecommendations(item.type!, item.id, 3);
                    item.recommendations = recs;
                    return item;
                } catch (err) {
                    this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                    return item;
                }
            });

            // Process in smaller batches to avoid overwhelming TMDB
            const updatedItems = await this.withConcurrencyLimit(tasks, 3);

            // Update cache with populated recommendations
            await this.redisService.set(cacheKey, JSON.stringify(updatedItems), this.CACHE_TTL.BASIC_DATA);
        }, 100); // Small delay to return main response first
    }

    // Optimized: collection -> recommendations -> similar
    // ENHANCED: Smart recommendations with guaranteed minimum count
    async getSmartRecommendations(
        type: "movie" | "tv",
        id: number,
        limit = 10,
        minRequired = 3
    ): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.RECOMMENDATIONS;
        const cacheKey = `smart-rec-v2-${type}-${id}-${limit}`;

        // Check cache first
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                const result = JSON.parse(cached) as TmdbAll[];
                if (result.length >= minRequired) {
                    return result;
                }
            } catch { /* continue to fresh fetch */ }
        }

        if (!this.token) {
            return [];
        }

        // Define candidate interface
        interface Candidate {
            id: number;
            title?: string;
            name?: string;
            overview?: string;
            poster_path?: string | null;
            backdrop_path?: string | null;
            release_date?: string | null;
            first_air_date?: string | null;
            vote_average?: number;
            vote_count?: number;
            popularity?: number;
            origin_country?: string[];
            production_countries?: Array<{ iso_3166_1: string }>;
            genre_ids?: number[];
            original_language?: string;
            source: string;
            priority: number;
        }

        try {
            // STEP 1: Get base item details
            const baseItem = await this.tmdb(`${this.baseUrl}/${type}/${id}?language=en-US`);
            if (!baseItem) return [];

            const baseLang = baseItem.original_language;
            const baseGenreIds: number[] = (baseItem.genres ?? []).map((g: any) => g.id);
            const baseCountries: string[] = type === "tv" ?
                (baseItem.origin_country ?? []) :
                (baseItem.production_countries?.map((c: any) => c.iso_3166_1) ?? []);

            // STEP 2: Multi-source recommendation gathering
            const allCandidates: Candidate[] = [];
            const seenIds = new Set([id]); // Exclude the original item

            // Source 1: Collection (for movies)
            if (type === "movie" && baseItem.belongs_to_collection?.id) {
                try {
                    const collData = await this.tmdb(`${this.baseUrl}/collection/${baseItem.belongs_to_collection.id}?language=en-US`);
                    const parts = (collData?.parts ?? []).filter((p: any) => p.id !== id);
                    for (const part of parts) {
                        if (!seenIds.has(part.id)) {
                            const candidate: Candidate = {
                                ...part,
                                source: 'collection',
                                priority: 1
                            };
                            allCandidates.push(candidate);
                            seenIds.add(part.id);
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Collection fetch failed for ${id}`, err);
                }
            }

            // Source 2: Direct recommendations and similar (parallel)
            const [recData, simData] = await Promise.allSettled([
                this.tmdb(`${this.baseUrl}/${type}/${id}/recommendations?language=en-US&page=1`),
                this.tmdb(`${this.baseUrl}/${type}/${id}/similar?language=en-US&page=1`)
            ]);

            if (recData.status === "fulfilled" && recData.value?.results) {
                for (const item of recData.value.results) {
                    if (!seenIds.has(item.id)) {
                        const candidate: Candidate = {
                            ...item,
                            source: 'recommendations',
                            priority: 2
                        };
                        allCandidates.push(candidate);
                        seenIds.add(item.id);
                    }
                }
            }

            if (simData.status === "fulfilled" && simData.value?.results) {
                for (const item of simData.value.results) {
                    if (!seenIds.has(item.id)) {
                        const candidate: Candidate = {
                            ...item,
                            source: 'similar',
                            priority: 3
                        };
                        allCandidates.push(candidate);
                        seenIds.add(item.id);
                    }
                }
            }

            // Source 3: Genre-based discovery (if we need more)
            if (allCandidates.length < limit * 2 && baseGenreIds.length > 0) {
                try {
                    const genreQuery = baseGenreIds.slice(0, 2).join(',');
                    const discoverUrl = `${this.baseUrl}/discover/${type}?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

                    if (baseLang && baseCountries.length > 0) {
                        // Try language + country specific first
                        const langCountryUrl = `${discoverUrl}&with_original_language=${baseLang}&with_origin_country=${baseCountries[0]}`;
                        const langCountryData = await this.tmdb(langCountryUrl);
                        if (langCountryData?.results) {
                            for (const item of langCountryData.results.slice(0, 10)) {
                                if (!seenIds.has(item.id)) {
                                    const candidate: Candidate = {
                                        ...item,
                                        source: 'genre-lang-country',
                                        priority: 4
                                    };
                                    allCandidates.push(candidate);
                                    seenIds.add(item.id);
                                }
                            }
                        }
                    }

                    // Fallback to general genre discovery
                    if (allCandidates.length < limit * 1.5) {
                        const genreData = await this.tmdb(discoverUrl);
                        if (genreData?.results) {
                            for (const item of genreData.results.slice(0, 15)) {
                                if (!seenIds.has(item.id)) {
                                    const candidate: Candidate = {
                                        ...item,
                                        source: 'genre',
                                        priority: 5
                                    };
                                    allCandidates.push(candidate);
                                    seenIds.add(item.id);
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Genre discovery failed for ${id}`, err);
                }
            }

            // Source 4: Popular items as last resort
            if (allCandidates.length < minRequired * 2) {
                try {
                    const popularData = await this.tmdb(`${this.baseUrl}/${type}/popular?language=en-US&page=1`);
                    if (popularData?.results) {
                        for (const item of popularData.results.slice(0, 20)) {
                            if (!seenIds.has(item.id)) {
                                const candidate: Candidate = {
                                    ...item,
                                    source: 'popular',
                                    priority: 6
                                };
                                allCandidates.push(candidate);
                                seenIds.add(item.id);
                            }
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Popular fallback failed for ${id}`, err);
                }
            }

            // STEP 3: Enhanced scoring
            interface ScoredCandidate extends Candidate {
                score: number;
            }

            const scoredCandidates: ScoredCandidate[] = allCandidates.map(candidate => {
                let score = 0;

                // Priority bonus (collection > recommendations > similar > genre-specific > genre-general > popular)
                const priorityBonus = [0, 100, 80, 70, 60, 40, 20][candidate.priority] || 0;
                score += priorityBonus;

                // Language match (very important for Korean content)
                if (baseLang && candidate.original_language === baseLang) {
                    score += 50;
                }

                // Country match (important for regional content)
                if (baseCountries.length > 0) {
                    const candidateCountries = candidate.origin_country ||
                        (candidate.production_countries?.map((c: any) => c.iso_3166_1)) || [];

                    const hasCountryMatch = candidateCountries.some(c => baseCountries.includes(c));
                    if (hasCountryMatch) {
                        score += 40;
                    }
                }

                // Genre overlap
                const candidateGenres = candidate.genre_ids || [];
                if (baseGenreIds.length > 0 && candidateGenres.length > 0) {
                    const overlap = baseGenreIds.filter(g => candidateGenres.includes(g)).length;
                    score += overlap * 15;
                }

                // Popularity and rating factors
                score += Math.min(15, (candidate.popularity || 0) / 20);
                score += Math.min(10, (candidate.vote_average || 0) * 1.2);

                // Recency bonus for newer content
                if (candidate.release_date || candidate.first_air_date) {
                    const releaseDate = new Date(candidate.release_date || candidate.first_air_date!);
                    const yearsDiff = (Date.now() - releaseDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
                    if (yearsDiff < 3) {
                        score += Math.max(0, 10 - yearsDiff * 3);
                    }
                }

                return { ...candidate, score };
            });

            // Sort by score
            scoredCandidates.sort((a, b) => b.score - a.score);

            // Take top candidates for trailer fetching (ensure we have enough)
            const topCandidates = scoredCandidates.slice(0, Math.max(limit * 3, minRequired * 5));

            // STEP 4: Fetch trailers with concurrency control
            interface TrailerCandidate extends ScoredCandidate {
                trailer_key: string | null;
                hasTrailer: boolean;
            }

            const trailerTasks = topCandidates.map(candidate => async (): Promise<TrailerCandidate> => {
                try {
                    const videosData = await this.tmdb(`${this.baseUrl}/${type}/${candidate.id}/videos?language=en-US`);
                    const trailerTypes = ['Trailer', 'Teaser', 'Clip'];

                    let trailer: any = null;
                    for (const trailerType of trailerTypes) {
                        trailer = (videosData?.results ?? []).find(
                            (v: any) => v.type === trailerType && v.site === 'YouTube'
                        );
                        if (trailer) break;
                    }

                    return {
                        ...candidate,
                        trailer_key: trailer?.key || null,
                        hasTrailer: !!trailer
                    };
                } catch {
                    return {
                        ...candidate,
                        trailer_key: null,
                        hasTrailer: false
                    };
                }
            });

            const withTrailerInfo = await this.withConcurrencyLimit(trailerTasks, 6);

            // Separate items with and without trailers, prioritize those with trailers
            const withTrailers = withTrailerInfo.filter(item => item.hasTrailer);
            const withoutTrailers = withTrailerInfo.filter(item => !item.hasTrailer);

            // Combine, prioritizing items with trailers but ensuring minimum count
            let finalCandidates = [...withTrailers, ...withoutTrailers];

            // Ensure we have at least the minimum required
            if (finalCandidates.length < minRequired) {
                this.logger.warn(`Only found ${finalCandidates.length} recommendations for ${type}/${id}, less than required ${minRequired}`);
            }

            // Transform to final format
            const final: TmdbAll[] = finalCandidates.slice(0, limit).map(item => ({
                id: item.id,
                title: item.title || item.name || "Untitled",
                overview: item.overview || "",
                poster_path: item.poster_path || null,
                backdrop_path: item.backdrop_path || null,
                release_date: item.release_date || item.first_air_date || null,
                vote_average: item.vote_average,
                vote_count: item.vote_count,
                popularity: item.popularity,
                origin_country: item.origin_country || [],
                genres: (item.genre_ids || []).map((gid: number) => this.genreMap[gid] || "Unknown"),
                trailer_key: item.trailer_key,
                type,
            }));

            // Cache the results
            await this.redisService.set(cacheKey, JSON.stringify(final), ttlSec);
            return final;

        } catch (err) {
            this.logger.error(`getSmartRecommendations failed for ${type}/${id}`, err);
            return [];
        }
    }


    // OPTIMIZED: Korea trending with background processing + filtering
    async getKoreaTrending(limit = 30): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.BASIC_DATA;
        const cacheKey = `koreaTrending-${limit}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached) as TmdbAll[];
                return parsed.slice(0, limit);
            } catch { }
        }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
            return [];
        }

        try {
            // Fetch Korean TV + Korean Movies in parallel with TMDB-side filters
            const [tvData, movieData] = await Promise.all([
                this.tmdb(`${this.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`),
                this.tmdb(`${this.baseUrl}/discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`)
            ]);

            let results = [
                ...(tvData?.results ?? []),
                ...(movieData?.results ?? [])
            ];

            // Post-fetch aggressive filter
            results = this.filterAdultishContent(results);
            const uniqueItems = Array.from(
                new Map(results.map((item) => [item.id, item])).values()
            );
            // Process basic info first and defer recommendations
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
                    genres: m.genre_ids?.map((id: number) => this.genreMap[id] || 'Unknown') ?? [],
                    type,
                    recommendations: [], // Populate later in background
                };
            });

            const shuffled = shuffleArray(items);

            // Cache and start background recommendation population
            // await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);
            this.populateRecommendationsBackground(shuffled, cacheKey);

            return shuffled.slice(0, Math.max(0, limit));
        } catch (err) {
            this.logger.error('Failed to fetch koreaTrending', err as any);
            return [];
        }
    }

    /**
 * Filters a results array (movies/tv) to remove adult-ish items.
 */
    private filterAdultishContent(results: any[]): any[] {
        if (!Array.isArray(results)) return [];
        return results.filter((m) => {
            try {
                return !this.isAdultishItem(m);
            } catch {
                return true;
            }
        });
    }

    // OPTIMIZED: Enhanced Trailers with better filtering and fallbacks
    async getTrailers(limit = 30): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.TRAILERS;
        const cacheKey = `trailers-enhanced-${limit}`;

        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached) as TmdbAll[];
                return parsed;
            } catch { }
        }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const data = await this.tmdb(`${this.baseUrl}/trending/all/week?language=en-US&page=1`);
            const results = Array.isArray(data?.results) ? data.results : [];
            if (!results.length) return [];

            // Deduplicate by ID while preserving order
            const uniqueItems: any[] = [];
            const seenIds = new Set<number>();
            for (const item of results) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueItems.push(item);
                }
            }

            // Process with enhanced trailer fetching
            const trailerTasks = uniqueItems.slice(0, limit * 2).map((m: any) => async (): Promise<TmdbAll | null> => {
                try {
                    const type = m.media_type;
                    const allowedRegions = ['US', 'GB', 'CA', 'AU'];

                    // Fetch videos and details in parallel
                    const [videosData, details] = await Promise.all([
                        this.tmdb(`${this.baseUrl}/${type}/${m.id}/videos?language=en-US`),
                        this.tmdb(`${this.baseUrl}/${type}/${m.id}?language=en-US`).catch(() => null)
                    ]);

                    const videos = videosData?.results || [];

                    // Filter videos using the same criteria as processItemWithVideos
                    const filteredVideos = videos.filter(v =>
                        v.site === "YouTube" &&
                        (v.type === "Trailer" || v.type === "Teaser" || v.type === "Clip") &&
                        v.key &&
                        v.key.length > 5 &&
                        (allowedRegions.includes(v.iso_3166_1) || !v.iso_3166_1) &&
                        v.name &&
                        !/reaction/i.test(v.name) &&
                        !/review/i.test(v.name) &&
                        !/behind the scenes/i.test(v.name) &&
                        !DISQUALIFY_RE.test(v.name)   // <-- Filter out red band / uncut / nsfw etc early
                    );

                    if (filteredVideos.length === 0) return null;

                    // Check availability for top candidates
                    const checkLimit = Math.min(filteredVideos.length, 5);
                    const videosToCheck = filteredVideos.slice(0, checkLimit);

                    const availabilityChecks = await Promise.allSettled(
                        videosToCheck.map(async v => ({
                            ...v,
                            available: await this.isVideoAvailable(v.key)
                        }))
                    );

                    const availableVideos = availabilityChecks
                        .filter((result): result is PromiseFulfilledResult<any> =>
                            result.status === 'fulfilled' && result.value.available
                        )
                        .map(result => result.value);

                    if (availableVideos.length === 0) return null;

                    // Score and sort videos
                    const scoredVideos = availableVideos
                        .filter(v => !/red\s*band/i.test(v.name))
                        .map(v => ({
                            ...v,
                            score: this.calculateVideoScore(v)
                        }))
                        .sort((a, b) => b.score - a.score);


                    // Optional: log after sorting
                    scoredVideos.forEach(v => console.log(v.name, v.score));

                    // Get the best video
                    const bestVideo = scoredVideos[0];


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
                        trailer_key: bestVideo.key,
                        recommendations: [],
                        runtime: undefined,
                        genres: details?.genres ? details.genres.map((g: any) => g.name) : [],
                        origin_country: details?.origin_country ?? m.origin_country ?? [],
                        type: type,
                        genre_ids: details?.genres ? details.genres.map((g: any) => g.id) : m.genre_ids ?? [],
                    };
                } catch (err) {
                    this.logger.warn(`Failed to process trailer for ${m.id}`, err);
                    return null;
                }
            });

            const withTrailers = (await this.withConcurrencyLimit(trailerTasks, 5))
                .filter((item): item is TmdbAll => item !== null)
                .slice(0, limit);

            // Background population of recommendations
            this.populateRecommendationsBackground(withTrailers, cacheKey);

            // Cache and shuffle results
            const shuffled = shuffleArray(withTrailers);
            return shuffled;
        } catch (err) {
            this.logger.error('Failed to fetch trailers', err as any);
            return [];
        }
    }

    // Keep existing methods with optimizations
    async getFavorites(limit = 30): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.BASIC_DATA;

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
            return [];
        }

        try {
            const MIN_RESULTS = 25;
            const MAX_PAGES = 5; // safety cap
            let collected: TmdbAll[] = [];

            for (let page = 1; page <= MAX_PAGES && collected.length < limit; page++) {
                const data = await this.tmdb(`/trending/all/day?page=${page}`);
                const results = data?.results ?? [];

                const filtered = results.filter(
                    (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
                );

                const clean = this.filterAdultishContent(filtered);
                const uniqueItems = Array.from(
                    new Map(clean.map((item) => [item.id, item])).values()
                );
                const mapped: TmdbAll[] = uniqueItems.map((m: any) => ({
                    id: m.id,
                    title: m.title ?? m.name ?? 'Untitled',
                    overview: m.overview ?? '',
                    genres: m.genre_ids
                        ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
                        : [],
                    poster_path: m.poster_path ?? null,
                    backdrop_path: m.backdrop_path ?? null,
                    release_date: m.release_date ?? m.first_air_date ?? null,
                    vote_average: m.vote_average,
                    type: m.media_type,
                }));

                collected.push(...mapped);
            }

            // Ensure at least MIN_RESULTS (fallback if TMDB had fewer results)
            if (collected.length < MIN_RESULTS) {
                this.logger.warn(
                    `Only ${collected.length} favorites collected, less than the minimum ${MIN_RESULTS}`
                );
            }

            // Shuffle *after* collecting enough
            const shuffled = shuffleArray(collected);
            const sliced = shuffled.slice(0, Math.max(MIN_RESULTS, limit));

            return sliced;
        } catch (err) {
            this.logger.error('Failed to fetch favorites', err as any);
            return [];
        }
    }


    // Legacy methods kept for compatibility
    async getRecommendations(type: 'movie' | 'tv', id: number, limit = 10): Promise<TmdbAll[]> {
        return this.getSmartRecommendations(type, id, limit);
    }

    // People — filter out persons who appear to be adult/erotic stars
    async getPeople(limit = 30): Promise<TmdbPerson[]> {
        const ttlSec = this.CACHE_TTL.BASIC_DATA;
        // const cacheKey = `people-${limit}`;

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty people');
            return [];
        }

        try {
            const perPage = 20; // TMDB default results per page
            // Choose max pages to fetch: enough to satisfy 'limit' but capped
            const approximatePagesNeeded = Math.ceil(limit / perPage);
            const MAX_PAGES = Math.min(10, Math.max(10, approximatePagesNeeded + 1)); // configurable cap

            const collectedRaw: any[] = [];
            const seenIds = new Set<number>();

            for (let page = 1; page <= MAX_PAGES && collectedRaw.length < limit; page++) {
                const url = `${this.baseUrl}/person/popular?include_adult=false&page=${page}`;
                const data = await this.tmdb(url);
                const results = data?.results ?? [];

                if (!results.length) break;

                // Filter the raw page results aggressively (remove adultish people)
                const cleanPage = this.filterPeopleList(results);

                // Add unique people from this page
                for (const p of cleanPage) {
                    if (!p || typeof p.id !== 'number') continue;
                    if (seenIds.has(p.id)) continue;
                    seenIds.add(p.id);
                    collectedRaw.push(p);
                    if (collectedRaw.length >= limit) break;
                }

                // small optimization: if total pages available < current page, break
                const totalPages = data?.total_pages ?? 0;
                if (totalPages && page >= totalPages) break;
            }

            // Map to TmdbPerson shape
            const people: TmdbPerson[] = collectedRaw.map((m: any) => ({
                id: m.id,
                name: m.name ?? 'Unknown',
                known_for_department: m.known_for_department,
                profile_path: m.profile_path ?? null,
                popularity: m.popularity ?? 0,
                known_for: (m.known_for ?? []).map((kf: any) => ({
                    id: kf.id,
                    title: kf.title,
                    name: kf.name,
                    media_type: kf.media_type,
                    poster_path: kf.poster_path ?? null,
                    overview: kf.overview,
                })),
            }));

            const sliced = people.slice(0, Math.max(0, limit));
            // Cache and return a shuffled result
            // await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
            return shuffleArray(sliced);
        } catch (err) {
            this.logger.error('Failed to fetch people', err as any);
            return [];
        }
    }

    async trending(type: string) {
        // const cacheKey = `trending/all/${type}`;
        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     return JSON.parse(cached);
        // }

        const data = await this.tmdb(`trending/all/${type}`);
        const results = data?.results ?? [];

        // await this.redisService.set(cacheKey, JSON.stringify(results), 60);
        return results;
    }

    private readonly BANNED_WORDS = [
        // Korean + English keywords often signaling erotic content
        "에로", "성인", "야한", "포르노", "섹스", "성적", "노출", "관음", "야설",
        "porn", "sex", "xxx", "erotic", "adult", "nude", "av"
    ];

    // Genre IDs you consider suspicious — tune as needed.
    // (these are example IDs; keep/replace with IDs you observe causing problems)
    private readonly BANNED_GENRE_IDS = new Set<number>([
  // put genre ids you want to block (be careful: 10749 = Romance might be too broad)
  /* e.g. 10749, */ 2916, 3568, 2972, 10364
    ]);

    private readonly MIN_VOTE_COUNT = 20; // discard very low-vote items (often low-quality adult content)

    /**
     * Checks if a single TMDB result (movie/tv/object from discover/trending) looks adult/erotic.
     */
    private isAdultishItem(m: any): boolean {
        // normalize texts
        const title = (m.title ?? m.name ?? "").toString().toLowerCase();
        const overview = (m.overview ?? "").toString().toLowerCase();

        // 1) keyword match in title/overview
        for (const bad of this.BANNED_WORDS) {
            if (title.includes(bad) || overview.includes(bad)) return true;
        }

        // 2) genre id match
        if (Array.isArray(m.genre_ids) && m.genre_ids.some((g: number) => this.BANNED_GENRE_IDS.has(g))) {
            return true;
        }

        // 3) explicit TMDB adult flag if present
        if (m.adult === true) return true;

        // 4) low vote_count heuristic (optional but useful)
        if (typeof m.vote_count === "number" && m.vote_count < this.MIN_VOTE_COUNT) {
            // If it's also very short runtime (if available) we might exclude, but runtime often not present.
            return true;
        }

        // 5) runtime/episode length heuristic for movies (if present)
        if (m.runtime && m.runtime > 0 && m.runtime < 50) return true;

        return false;
    }
    /**
     * Filters people list by excluding persons with adult flag or whose known_for items are adultish.
     */
    private filterPeopleList(people: any[]): any[] {
        if (!Array.isArray(people)) return [];
        return people.filter(person => {
            // drop explicit adult person
            if (person.adult === true) return false;

            // If no known_for, keep (or drop — choose policy)
            const knownFor = person.known_for ?? [];
            if (!Array.isArray(knownFor) || knownFor.length === 0) {
                return true;
            }
            if (person.profile_path === null) {
                return false;
            }

            // Exclude person if any of their known_for items looks adultish
            for (const item of knownFor) {
                if (this.isAdultishItem(item)) return false;
            }

            // Optionally exclude if majority of known_for items are low-vote
            const lowVotes = knownFor.filter((k: any) => (k.vote_count ?? 0) < this.MIN_VOTE_COUNT).length;
            if (lowVotes >= Math.ceil(knownFor.length * 0.75)) return false;

            return true;
        });
    }
    async getSearchSuggestions(query: string, limit: number = 6) {
        const ttlSec = 60 * 5; // Cache for 5 minutes
        const cacheKey = `search-suggestions-${query.toLowerCase()}-${limit}`;

        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     try {
        //         return JSON.parse(cached);
        //     } catch { }
        // }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty suggestions');
            return [];
        }

        try {
            // Search for both movies and TV shows
            const [moviesData, tvData] = await Promise.all([
                this.tmdb(`${this.baseUrl}/search/movie?language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`),
                this.tmdb(`${this.baseUrl}/search/tv?language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`)
            ]);

            const movies = moviesData?.results ?? [];
            const tvShows = tvData?.results ?? [];

            // Combine and format results
            const combined = [
                ...movies.map(item => ({
                    id: item.id,
                    title: item.title ?? 'Untitled',
                    type: 'movie' as const,
                    year: item.release_date ? new Date(item.release_date).getFullYear() : null,
                    poster_path: item.poster_path ?? null,
                    popularity: item.popularity ?? 0,
                    vote_average: item.vote_average ?? 0,
                })),
                ...tvShows.map(item => ({
                    id: item.id,
                    title: item.name ?? 'Untitled',
                    type: 'tv' as const,
                    year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : null,
                    poster_path: item.poster_path ?? null,
                    popularity: item.popularity ?? 0,
                    vote_average: item.vote_average ?? 0,
                })),
            ];

            // Sort by popularity and rating, then limit
            const results = combined
                .filter(item => item.poster_path) // Only include items with posters for better UX
                .sort((a, b) => {
                    // Prioritize by popularity first, then by rating
                    const popDiff = b.popularity - a.popularity;
                    if (Math.abs(popDiff) > 10) return popDiff;
                    return b.vote_average - a.vote_average;
                })
                .slice(0, limit);

            // await this.redisService.set(cacheKey, JSON.stringify(results), ttlSec);
            return results;

        } catch (err) {
            this.logger.error(`Failed to fetch search suggestions for "${query}"`, err as any);
            return [];
        }
    }

    async getTrendingSearchTerms(): Promise<TrendingTerm[]> {
        const ttlSec = 60 * 60; // Cache for 1 hour
        const cacheKey = 'trending-search-terms';

        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     try {
        //         return JSON.parse(cached);
        //     } catch { }
        // }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning fallback search terms');
            return this.getFallbackSearchTerms();
        }

        try {
            // Get trending movies and TV shows
            const trendingData = await this.tmdb(`${this.baseUrl}/trending/all/week?language=en-US&page=1`);
            const results = Array.isArray(trendingData?.results) ? trendingData.results : [];

            // Map to id/title/media_type and dedupe by id
            const seen = new Set<number>();
            const terms: TrendingTerm[] = results
                .map((item: any) => {
                    const id = Number(item?.id) || 0;
                    const title = item?.title ?? item?.name ?? null;
                    const media_type = item?.media_type ?? (item?.title ? 'movies' : item?.name ? 'tv' : 'unknown');
                    if (!id || !title) return null;
                    return { id, title: String(title), media_type };
                })
                .filter(Boolean)
                .filter((t: TrendingTerm) => {
                    if (seen.has(t.id)) return false;
                    seen.add(t.id);
                    return true;
                })
                .slice(0, 9);

            if (terms.length === 0) {
                return this.getFallbackSearchTerms();
            }

            // await this.redisService.set(cacheKey, JSON.stringify(terms), ttlSec);
            return terms;

        } catch (err) {
            this.logger.error('Failed to fetch trending search terms', err as any);
            return this.getFallbackSearchTerms();
        }
    }

    private getFallbackSearchTerms(): TrendingTerm[] {
        return [
            { id: 0, title: 'Avengers', media_type: 'movie' },
            { id: 0, title: 'Stranger Things', media_type: 'tv' },
            { id: 0, title: 'Batman', media_type: 'movie' },
        ];
    }
    async getTrendingReviews(limit = 40): Promise<{
        quote: string;
        name: string;
        title: string;
        avatar: string;
        rating?: number | null;
    }[]> {
        const ttlSec = 60 * 10;
        // const cacheKey = `trendingReviews`;

        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     try {
        //         return JSON.parse(cached);
        //     } catch { }
        // }

        if (!this.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty reviews');
            return [];
        }

        try {
            const reviews: {
                quote: string;
                name: string;
                title: string;
                avatar: string;
                rating?: number | null;
            }[] = [];

            const trendingPages = 3;
            const reviewPages = 3;

            for (let p = 1; p <= trendingPages; p++) {
                const trendingData = await this.tmdb(`${this.baseUrl}/trending/all/week?language=en-US&page=${p}`);
                const results = trendingData?.results ?? [];

                for (const item of results) {
                    if (reviews.length >= limit) break;

                    const reviewPromises: Promise<any>[] = [];
                    for (let rp = 1; rp <= reviewPages; rp++) {
                        const reviewUrl = `${this.baseUrl}/${item.media_type}/${item.id}/reviews?language=en-US&page=${rp}`;
                        reviewPromises.push(this.tmdb(reviewUrl));
                    }

                    const reviewPagesData = await Promise.all(reviewPromises);

                    for (const pageData of reviewPagesData) {
                        const reviewsPage = pageData?.results ?? [];
                        for (const review of reviewsPage) {
                            const avatarPath = review?.author_details?.avatar_path;
                            if (avatarPath) {
                                let avatar = avatarPath.trim();
                                if (avatar.startsWith("/http")) avatar = avatar.substring(1);
                                else if (avatar.startsWith("/")) avatar = `https://image.tmdb.org/t/p/w185${avatar}`;

                                reviews.push({
                                    quote: review.content.slice(0, 200) + "...",
                                    name: review.author ?? "Anonymous",
                                    title: item.title ?? item.name ?? "Untitled",
                                    avatar,
                                    rating: review.author_details.rating ?? null,
                                });
                            }

                            if (reviews.length >= limit) break;
                        }
                        if (reviews.length >= limit) break;
                    }
                }

                if (reviews.length >= limit) break;
            }

            const shuffled = reviews.sort(() => Math.random() - 0.5);
            // await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);
            return shuffled;
        } catch (err) {
            this.logger.error('Failed to fetch trending reviews', err as any);
            return [];
        }
    }

    async getUpcomingTrailers(limit = 30): Promise<TmdbAll[]> {
        const ttlSec = this.CACHE_TTL.TRAILERS;
        const cacheKey = `trailers-upcoming-${limit}`;

        if (!this.token) {
            this.logger.warn("TMDB_API_KEY not set; returning empty trailers");
            return [];
        }

        try {
            const items: TmdbAll[] = [];
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
            const maxPages = 20;
            const allowedRegions = ['US', 'GB', 'CA', 'AU'];

            const fetchTrailers = async (mediaType: "movie" | "tv") => {
                for (let page = 1; page <= maxPages; page++) {
                    const url =
                        mediaType === "movie"
                            ? `${this.baseUrl}/discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`
                            : `${this.baseUrl}/discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${page}`;

                    const data = await this.tmdb(url);
                    const results = data?.results ?? [];

                    // Process with concurrency control
                    const trailerTasks = results.map((m: any) => async () => {
                        const rd = m.release_date ?? m.first_air_date;
                        if (!rd || new Date(rd) < today) return null;

                        try {
                            // Fetch videos and details in parallel
                            const [videosData, details] = await Promise.all([
                                this.tmdb(`${this.baseUrl}/${mediaType}/${m.id}/videos?language=en-US`),
                                this.tmdb(`${this.baseUrl}/${mediaType}/${m.id}?language=en-US`)
                            ]);

                            const videos = videosData?.results || [];

                            // Filter videos using the same criteria
                            const filteredVideos = videos.filter(v =>
                                v.site === "YouTube" &&
                                (v.type === "Trailer" || v.type === "Teaser" || v.type === "Clip") &&
                                v.key &&
                                v.key.length > 5 &&
                                (allowedRegions.includes(v.iso_3166_1) || !v.iso_3166_1) &&
                                v.name &&
                                !/reaction/i.test(v.name) &&
                                !/review/i.test(v.name) &&
                                !/behind the scenes/i.test(v.name) &&
                                !DISQUALIFY_RE.test(v.name)   // <-- Filter out red band / uncut / nsfw etc early
                            );

                            if (filteredVideos.length === 0) return null;

                            // Check availability for top candidates
                            const checkLimit = Math.min(filteredVideos.length, 5);
                            const videosToCheck = filteredVideos.slice(0, checkLimit);

                            const availabilityChecks = await Promise.allSettled(
                                videosToCheck.map(async v => ({
                                    ...v,
                                    available: await this.isVideoAvailable(v.key)
                                }))
                            );

                            const availableVideos = availabilityChecks
                                .filter((result): result is PromiseFulfilledResult<any> =>
                                    result.status === 'fulfilled' && result.value.available
                                )
                                .map(result => result.value);

                            if (availableVideos.length === 0) return null;

                            // Score and sort videos
                            const scoredVideos = availableVideos.map(v => ({
                                ...v,
                                score: this.calculateVideoScore(v)
                            })).sort((a, b) => b.score - a.score);

                            // Get the best video
                            const bestVideo = scoredVideos[0];

                            return {
                                id: m.id,
                                title: m.title ?? m.name ?? "Untitled",
                                overview: m.overview ?? "",
                                poster_path: m.poster_path ?? null,
                                backdrop_path: m.backdrop_path ?? null,
                                release_date: rd,
                                vote_average: m.vote_average,
                                trailer_key: bestVideo.key,
                                type: mediaType,
                                recommendations: [],
                                runtime: mediaType === "movie" ? details.runtime ?? null : null,
                                number_of_episodes: mediaType === "tv" ? details.number_of_episodes ?? null : null,
                                genres: details.genres ? details.genres.map((g: any) => g.name) : [],
                            } as TmdbAll;
                        } catch {
                            return null;
                        }
                    });

                    const pageResults = (await this.withConcurrencyLimit(trailerTasks))
                        .filter((item): item is TmdbAll => item !== null);

                    items.push(...pageResults);

                    if (items.length >= limit) break;
                }
            };

            // Fetch both movie and TV concurrently
            await Promise.all([fetchTrailers("movie"), fetchTrailers("tv")]);

            // Sort by release date and limit
            const sorted = items
                .sort(
                    (a, b) =>
                        (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
                        (b.release_date ? new Date(b.release_date).getTime() : Infinity)
                )
                .slice(0, limit);

            // Populate recommendations in background
            setTimeout(async () => {
                const tasks = sorted.map(item => async () => {
                    try {
                        item.recommendations = await this.getSmartRecommendations(item.type!, item.id, 3);
                        return item;
                    } catch (err) {
                        this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                        return item;
                    }
                });

                await this.withConcurrencyLimit(tasks, 3);
            }, 100);

            return sorted;
        } catch (err) {
            this.logger.error("Failed to fetch upcoming trailers", err as any);
            return [];
        }
    }

    // NEW: Separate endpoint to get recommendations for a specific item
    async getItemRecommendations(type: 'movie' | 'tv', id: number, limit: number): Promise<TmdbAll[]> {
        return this.getSmartRecommendations(type, id, limit);
    }

    // NEW: Batch trailer fetching for multiple items
    async getTrailersForItems(items: { type: 'movie' | 'tv', id: number }[]): Promise<Record<string, string | null>> {
        // const cacheKey = `batch-trailers-${items.map(i => `${i.type}-${i.id}`).join(',')}`;
        // const cached = await this.redisService.get(cacheKey);

        // if (cached) {
        //     try {
        //         return JSON.parse(cached);
        //     } catch { }
        // }

        const tasks = items.map(item => async () => {
            try {
                const videosData = await this.tmdb(`${this.baseUrl}/${item.type}/${item.id}/videos?language=en-US`);
                const trailer = (videosData?.results ?? []).find(
                    (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
                );
                return [`${item.type}-${item.id}`, trailer?.key ?? null];
            } catch {
                return [`${item.type}-${item.id}`, null];
            }
        });

        const results = await this.withConcurrencyLimit(tasks);
        const trailerMap = Object.fromEntries(results);

        // await this.redisService.set(cacheKey, JSON.stringify(trailerMap), this.CACHE_TTL.TRAILERS);
        return trailerMap;
    }

    async images(id: number, type: string) {
        const data = await this.tmdb(`${type}/${id}/images`);
        if (!data) return { posters: [], backdrops: [] };

        const posters: string[] = (data.posters ?? [])
            .map((p: any) => p?.file_path ?? null)
            .filter((fp: string | null): fp is string => Boolean(fp));

        const backdrops: string[] = (data.backdrops ?? [])
            .map((b: any) => b?.file_path ?? null)
            .filter((fp: string | null): fp is string => Boolean(fp));

        return { posters, backdrops };
    }
    async getVideoFeed(page: number = 1, mediaType?: 'movie' | 'tv') {
        try {
            const requests: any = [];
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 2);
            const pastDateStr = pastDate.toISOString().split("T")[0];

            // Generate a session seed that changes periodically but stays consistent within a session
            const sessionSeed = Math.floor(Date.now() / (1000 * 60 * 15)); // Changes every 15 minutes
            const pageSeed = sessionSeed + page;

            // Vary the content sources based on page for more diversity
            const pageOffset = Math.floor((page - 1) / 3);

            if (!mediaType || mediaType === 'movie') {
                requests.push(
                    this.tmdb(`trending/movie/week?page=${page}`),
                    this.tmdb(`movie/popular?page=${page + pageOffset}`),
                    this.tmdb(`movie/now_playing?page=${page}`),
                    this.tmdb(`discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${pastDateStr}&page=${page}`),
                    this.tmdb(`discover/movie?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`),
                    // Add variety with different sort orders
                    this.tmdb(`discover/movie?sort_by=vote_average.desc&vote_count.gte=200&page=${page}`),
                );
            }

            if (!mediaType || mediaType === 'tv') {
                requests.push(
                    this.tmdb(`trending/tv/week?page=${page}`),
                    this.tmdb(`tv/popular?page=${page + pageOffset}`),
                    this.tmdb(`tv/on_the_air?page=${page}`),
                    this.tmdb(`tv/airing_today?page=${page}`),
                    this.tmdb(`discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${pastDateStr}&page=${page}`),
                    this.tmdb(`discover/tv?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`),
                    // Add variety with different genres periodically
                    this.tmdb(`discover/tv?sort_by=vote_average.desc&vote_count.gte=200&page=${page}`),
                );
            }

            const results = await Promise.allSettled(requests);
            const allItems: any[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value?.results) {
                    allItems.push(...result.value.results);
                }
            }

            // Pre-filter items before processing
            const filteredItems = this.preFilterItems(allItems);

            // Remove duplicates based on ID
            const uniqueItems = Array.from(
                new Map(filteredItems.map(item => [item.id, item])).values()
            );

            // Enhanced randomization with session seed
            const jitter = 2.0; // Increased for more variety
            const scoredMixed = this.seededShuffle(uniqueItems, pageSeed, jitter);

            // Dynamically adjust batch size for more variety
            const batchSize = 35; // Increased to check more items
            const itemsToEnrich = scoredMixed.slice(0, batchSize);

            const itemsWithVideos = await this.enrichWithVideos(itemsToEnrich, pageSeed);

            // Filter to ensure we have at least some items (and have primary_video)
            const validItems = itemsWithVideos.filter(item => item.primary_video);

            // Apply final shuffle to results for variety
            const finalResults = this.applyFinalShuffle(validItems, pageSeed);

            return {
                results: finalResults,
                page,
                total_pages: 100,
                hasMore: page < 100 && finalResults.length > 0
            };
        } catch (error) {
            console.error('Error fetching video feed:', error);
            return { results: [], page, total_pages: 0, hasMore: false };
        }
    }

    /**
     * Apply final shuffle to results while maintaining quality tiers
     */
    private applyFinalShuffle(items: any[], seed: number): any[] {
        if (items.length === 0) return items;

        // Group items into quality tiers
        const tiers = {
            premium: [] as any[],
            high: [] as any[],
            medium: [] as any[]
        };

        items.forEach(item => {
            const score = this.calculateItemQualityScore(item);
            if (score >= 45) tiers.premium.push(item);
            else if (score >= 35) tiers.high.push(item);
            else tiers.medium.push(item);
        });

        // Shuffle within each tier
        const shuffledPremium = this.seededShuffleArray(tiers.premium, seed);
        const shuffledHigh = this.seededShuffleArray(tiers.high, seed + 100);
        const shuffledMedium = this.seededShuffleArray(tiers.medium, seed + 200);

        // Mix tiers with weighted distribution
        const result: any[] = [];
        let pIdx = 0, hIdx = 0, mIdx = 0;

        while (pIdx < shuffledPremium.length || hIdx < shuffledHigh.length || mIdx < shuffledMedium.length) {
            // 2 premium items
            for (let i = 0; i < 2 && pIdx < shuffledPremium.length; i++) {
                result.push(shuffledPremium[pIdx++]);
            }
            // 1 high quality item
            if (hIdx < shuffledHigh.length) {
                result.push(shuffledHigh[hIdx++]);
            }
            // 1 premium item
            if (pIdx < shuffledPremium.length) {
                result.push(shuffledPremium[pIdx++]);
            }
            // 1 medium quality item for variety
            if (mIdx < shuffledMedium.length) {
                result.push(shuffledMedium[mIdx++]);
            }
        }

        return result;
    }

    /**
     * Seeded shuffle with enhanced randomization and Korean content mixing
     */
    private seededShuffle(array: any[], seed: number, jitter = 2.0): any[] {
        const seededRandomForId = (id: number | string, offset = 0) => {
            const n = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, '') || '0', 10);
            const x = Math.sin((seed + offset) * 9301 + n * 49297) * 43758.5453123;
            return Math.abs(x - Math.floor(x));
        };

        // Score all items and categorize
        const scoredItems = array.map(item => ({
            item,
            qualityScore: this.calculateItemQualityScore(item),
            isNewRelease: this.isRecentOrUpcoming(item),
            isKorean: item.original_language === 'ko'
        }));

        // Enhanced sort with more randomness
        const compareWithJitter = (a: any, b: any) => {
            const scoreDiff = b.qualityScore - a.qualityScore;
            if (jitter === 0) return scoreDiff;

            const randA = seededRandomForId(a.item.id ?? (Math.random() * 1000000));
            const randB = seededRandomForId(b.item.id ?? (Math.random() * 1000000));
            const randDiff = (randB - randA);
            const randomFactor = randDiff * jitter;

            return scoreDiff + randomFactor;
        };

        // Separate into categories for better mixing
        const newReleases = scoredItems.filter(s => s.isNewRelease);
        const koreanContent = scoredItems.filter(s => !s.isNewRelease && s.isKorean);
        const regularContent = scoredItems.filter(s => !s.isNewRelease && !s.isKorean);

        // Sort each category
        newReleases.sort(compareWithJitter);
        koreanContent.sort(compareWithJitter);
        regularContent.sort(compareWithJitter);

        // Mix all categories with weighted distribution
        const mixed: any[] = [];
        let newIdx = 0, koreanIdx = 0, regularIdx = 0;

        while (newIdx < newReleases.length || koreanIdx < koreanContent.length || regularIdx < regularContent.length) {
            // Add 2-3 regular items
            const regularCount = Math.floor(seededRandomForId(regularIdx + seed, 100) * 2) + 2;
            for (let i = 0; i < regularCount && regularIdx < regularContent.length; i++) {
                mixed.push(regularContent[regularIdx++].item);
            }

            // Add 1 new release
            if (newIdx < newReleases.length) {
                mixed.push(newReleases[newIdx++].item);
            }

            // Add 1 Korean content (increased frequency)
            if (koreanIdx < koreanContent.length) {
                mixed.push(koreanContent[koreanIdx++].item);
            }

            // Occasionally add another Korean item for more visibility
            if (koreanIdx < koreanContent.length && seededRandomForId(koreanIdx + seed, 200) > 0.6) {
                mixed.push(koreanContent[koreanIdx++].item);
            }
        }

        return mixed;
    }

    /**
     * Pre-filter items with enhanced Korean content support
     */
    private preFilterItems(items: any[]): any[] {
        const currentYear = new Date().getFullYear();

        return items.filter(item => {
            if (item.adult === true) return false;
            if (!item.poster_path) return false;

            const releaseYear = this.getItemYear(item);
            const isNewRelease = releaseYear && releaseYear >= currentYear && this.isRecentOrUpcoming(item);
            const isKorean = item.original_language === 'ko';

            // Relaxed filters for Korean content and new releases
            if (!isNewRelease && !isKorean) {
                const minVoteCount = 10;
                if ((item.vote_count || 0) < minVoteCount) return false;

                const minRating = 5.0;
                if ((item.vote_average || 0) < minRating) return false;
            } else if (isKorean && !isNewRelease) {
                // More lenient for Korean content
                if ((item.vote_count || 0) < 5) return false;
                if ((item.vote_average || 0) < 4.5) return false;
            }

            // Relaxed year filtering for Korean content
            if (releaseYear && releaseYear < (isKorean ? 1995 : 2000)) return false;

            if (!item.overview || item.overview.length < 10) return false;

            const allowedLanguages = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'pt', 'it', 'hi'];

            if (item.original_language && !allowedLanguages.includes(item.original_language)) {
                if ((item.vote_count || 0) < 500) return false;
            }

            return true;
        });
    }

    /**
     * Enhanced quality scoring with Korean content boost
     */
    private calculateItemQualityScore(item: any): number {
        let score = 0;

        const isNewRelease = this.isRecentOrUpcoming(item);
        const isKorean = item.original_language === 'ko';

        if (isNewRelease) score += 20;

        // Boost Korean content for visibility
        if (isKorean) score += 5;

        score += Math.log10((item.popularity || 1) + 1) * 8;

        if (item.vote_count > 0) {
            score += (item.vote_average || 0) * 3;
        }

        score += Math.log10((item.vote_count || 1) + 1) * 2;

        if (!isNewRelease) {
            const year = this.getItemYear(item);
            if (year) {
                const currentYear = new Date().getFullYear();
                const yearDiff = currentYear - year;
                if (yearDiff <= 2) score += 10;
                else if (yearDiff <= 5) score += 7;
                else if (yearDiff <= 10) score += 5;
                else if (yearDiff <= 15) score += 3;
            }
        }

        if (item.backdrop_path) score += 2;

        if (item.original_language === 'en') score += 4;
        else if (item.original_language === 'ko') score += 5;

        return score;
    }

    private isRecentOrUpcoming(item: any): boolean {
        const dateStr = item.release_date || item.first_air_date;
        if (!dateStr) return false;

        const releaseDate = new Date(dateStr);
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        return releaseDate >= threeMonthsAgo;
    }

    private getItemYear(item: any): number | null {
        const dateStr = item.release_date || item.first_air_date;
        if (!dateStr) return null;

        const year = parseInt(dateStr.split('-')[0]);
        return isNaN(year) ? null : year;
    }

    private seededShuffleArray(array: any[], seed: number): any[] {
        const shuffled = [...array];
        let currentIndex = shuffled.length;

        const random = () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };

        while (currentIndex !== 0) {
            const randomIndex = Math.floor(random() * currentIndex);
            currentIndex -= 1;
            const temp = shuffled[currentIndex];
            shuffled[currentIndex] = shuffled[randomIndex];
            shuffled[randomIndex] = temp;
        }

        return shuffled;
    }

    private async enrichWithVideos(items: any[], seed: number) {
        const enriched: any[] = [];
        const allowedRegions = [
            "MY", "SG", "ID", "TH", "PH", "VN", "BN", "KH", "LA",
            "HK", "TW", "IN", "AU", "NZ", "US", "GB", "KR", "JP"
        ];

        // Process items until we have enough enriched results
        const targetCount = Math.min(items.length, 30); // Target enriched count
        const batchSize = 8; // Increased batch size for faster processing

        this.logger.log(`Starting enrichment of ${items.length} items, target: ${targetCount}`);

        for (let i = 0; i < items.length && enriched.length < targetCount; i += batchSize) {
            const batch = items.slice(i, i + batchSize);

            const batchResults = await Promise.allSettled(
                batch.map(item => this.processItemWithVideos(item, allowedRegions, seed))
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                    enriched.push(result.value);
                    if (enriched.length >= targetCount) break;
                } else if (result.status === 'rejected') {
                    this.logger.error('Failed to process item:', result.reason);
                }
            }

            // Small delay between batches to avoid rate limiting
            if (i + batchSize < items.length && enriched.length < targetCount) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.logger.log(`Enrichment complete: ${enriched.length} items with valid videos`);
        return enriched;
    }

    private async processItemWithVideos(item: any, allowedRegions: string[], seed: number) {
        try {
            const mediaType = item.title ? "movie" : "tv";

            // Use cached videos if already fetched
            let videos = item.videos || [];

            // If no videos in item, fetch them
            if (videos.length === 0) {
                const videosResponse = await this.tmdb(`${mediaType}/${item.id}/videos`);
                videos = videosResponse.results || [];
            }

            // Filter videos based on criteria
            const filteredVideos = videos.filter(v =>
                v.site === "YouTube" &&
                (v.type === "Trailer" || v.type === "Teaser" || v.type === "Clip") &&
                v.key &&
                v.key.length > 5 &&
                (allowedRegions.includes(v.iso_3166_1) || !v.iso_3166_1) && // Allow videos without region or in allowed regions
                v.name &&
                !v.name.toLowerCase().includes('reaction') &&
                !v.name.toLowerCase().includes('review') &&
                !v.name.toLowerCase().includes('behind the scenes')
            );

            if (filteredVideos.length === 0) {
                this.logger.debug(`No valid videos for ${mediaType} ${item.id}`);
                return null;
            }

            // Check availability for top candidates
            const checkLimit = Math.min(filteredVideos.length, 5);
            const videosToCheck = filteredVideos.slice(0, checkLimit);

            const availabilityChecks = await Promise.allSettled(
                videosToCheck.map(async v => ({
                    ...v,
                    available: await this.isVideoAvailable(v.key)
                }))
            );

            const availableVideos = availabilityChecks
                .filter((result): result is PromiseFulfilledResult<any> =>
                    result.status === 'fulfilled' && result.value.available
                )
                .map(result => result.value);

            if (availableVideos.length === 0) {
                this.logger.debug(`No available videos for ${mediaType} ${item.id}`);
                return null;
            }

            // Score and sort videos
            const scoredVideos = availableVideos.map(v => ({
                ...v,
                score: this.calculateVideoScore(v)
            })).sort((a, b) => b.score - a.score);

            const topVideos = scoredVideos.slice(0, 8);

            // Enhanced primary video selection with variety
            const primaryCandidates = topVideos.slice(0, Math.min(4, topVideos.length));
            const primaryIndex = this.getSeededRandom(item.id + seed, primaryCandidates.length);
            const primaryVideo = primaryCandidates[primaryIndex];

            // Ensure primary video has required fields
            if (!primaryVideo || !primaryVideo.key) {
                this.logger.debug(`Primary video missing key for ${mediaType} ${item.id}`);
                return null;
            }

            return {
                ...item,
                media_type: mediaType,
                videos: topVideos,
                primary_video: primaryVideo,
            };
        } catch (err) {
            this.logger.error(`Error processing item ${item.id}:`, err);
            return null;
        }
    }

    private calculateVideoScore(video: any): number {
        let score = 0;
        const name = (video.name || "").toLowerCase();

        // Strong disqualifier: immediate fail score
        const DISQUALIFY_RE = /\b(red[-\s]?band|uncut|uncensored|nsfw|explicit|age[-\s]?restricted|18\+|adult|mature|tv[-\s]?ma|redband)\b/i;
        if (DISQUALIFY_RE.test(name)) {
            return -100000;
        }

        if (video.official) score += 10;

        if (video.type === "Trailer") score += 8;
        else if (video.type === "Teaser") score += 5;
        else if (video.type === "Clip") score += 2;

        if (video.size >= 2160) score += 6;
        else if (video.size >= 1080) score += 5;
        else if (video.size >= 720) score += 3;
        else if (video.size >= 480) score += 1;

        if (name.includes("official")) score += 3;
        if (name.includes("trailer")) score += 2;

        if (name.includes("fan") || name.includes("leak") || name.includes("leaked")) score -= 6;

        if (video.site === "YouTube") score += 2;

        return score;
    }

    private getSeededRandom(seed: number, max: number): number {
        const x = Math.sin(seed) * 10000;
        return Math.floor((x - Math.floor(x)) * max);
    }

    async getMovieVideos(id: number) {
        return await this.tmdb(`movie/${id}/videos`);
    }

    async getTvVideos(id: number) {
        return await this.tmdb(`tv/${id}/videos`);
    }

    /**
     * Check if a YouTube video is available (not blocked/deleted)
     */
    private async isVideoAvailable(videoKey: string): Promise<boolean> {
        try {
            // Use YouTube oEmbed API to check if video exists
            const response = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoKey}&format=json`,
                { method: 'GET', signal: AbortSignal.timeout(3000) }
            );
            return response.ok;
        } catch (err) {
            // If request fails, assume video is not available
            return false;
        }
    }

    async getUpcomingFeeds(page: number = 1, limit: number = 35): Promise<{
        results: any[];
        page: number;
        total_pages: number;
        hasMore: boolean;
    }> {
        const ttlSec = this.CACHE_TTL.TRAILERS;
        const pageCacheKey = `trailers-upcoming-page-${page}-${limit}`;

        if (!this.token) {
            this.logger.warn("TMDB_API_KEY not set; returning empty trailers");
            return { results: [], page, total_pages: 0, hasMore: false };
        }

        try {
            // Check page cache first for instant response
            // const cachedPage = await this.redisService.get(pageCacheKey);
            // if (cachedPage) {
            //     try {
            //         return JSON.parse(cachedPage);
            //     } catch { }
            // }

            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];

            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 6);
            const futureDateStr = futureDate.toISOString().split("T")[0];

            // FIXED: Better page distribution to avoid overlaps
            // Each page fetches from different TMDB pages with no overlap
            const tmdbPagesPerRequest = 3; // Fetch 3 TMDB pages per request
            const startTmdbPage = ((page - 1) * tmdbPagesPerRequest) + 1;
            const endTmdbPage = startTmdbPage + tmdbPagesPerRequest;

            this.logger.log(`Page ${page}: Fetching TMDB pages ${startTmdbPage}-${endTmdbPage - 1}`);

            const items: TmdbAll[] = [];
            const seenIds = new Set<number>(); // Track IDs within this request

            const fetchTrailers = async (mediaType: "movie" | "tv") => {
                const fetchedItems: TmdbAll[] = [];

                for (let tmdbPage = startTmdbPage; tmdbPage < endTmdbPage; tmdbPage++) {
                    try {
                        const url =
                            mediaType === "movie"
                                ? `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&primary_release_date.lte=${futureDateStr}&page=${tmdbPage}`
                                : `discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&first_air_date.lte=${futureDateStr}&page=${tmdbPage}`;

                        const data = await this.tmdb(url);
                        const results = data?.results ?? [];

                        // Process with higher concurrency for speed
                        const trailerTasks = results.map((m: any) => async () => {
                            // Skip if already seen in this request
                            if (seenIds.has(m.id)) return null;

                            const rd = m.release_date ?? m.first_air_date;
                            if (!rd || new Date(rd) < today) return null;

                            if (!m.poster_path || !m.overview || m.overview.length < 10) return null;

                            try {
                                // Fetch videos and details in parallel
                                const [videosData, details] = await Promise.all([
                                    this.tmdb(`${mediaType}/${m.id}/videos?language=en-US`),
                                    this.tmdb(`${mediaType}/${m.id}?language=en-US`)
                                ]);

                                // Store ALL videos for later enrichment
                                const allVideos = videosData?.results ?? [];

                                // Mark as seen
                                seenIds.add(m.id);

                                return {
                                    id: m.id,
                                    title: m.title ?? m.name ?? "Untitled",
                                    overview: m.overview ?? "",
                                    poster_path: m.poster_path ?? null,
                                    backdrop_path: m.backdrop_path ?? null,
                                    release_date: rd,
                                    vote_average: m.vote_average || 0,
                                    vote_count: m.vote_count || 0,
                                    type: mediaType,
                                    recommendations: [],
                                    runtime: mediaType === "movie" ? details.runtime ?? null : null,
                                    number_of_episodes: mediaType === "tv" ? details.number_of_episodes ?? null : null,
                                    genres: details.genres ? details.genres.map((g: any) => g.name) : [],
                                    popularity: m.popularity || 0,
                                    original_language: m.original_language || 'en',
                                    // Store videos for enrichment
                                    videos: allVideos,
                                } as TmdbAll;
                            } catch (err) {
                                this.logger.error(`Failed to fetch details for ${mediaType} ${m.id}`, err);
                                return null;
                            }
                        });

                        // Higher concurrency limit for faster processing
                        const pageResults = (await this.withConcurrencyLimit(trailerTasks, 10))
                            .filter((item): item is TmdbAll => item !== null);

                        fetchedItems.push(...pageResults);
                    } catch (err) {
                        this.logger.error(`Failed to fetch ${mediaType} page ${tmdbPage}`, err);
                    }
                }

                return fetchedItems;
            };

            // Fetch both movie and TV concurrently
            const [movieItems, tvItems] = await Promise.all([
                fetchTrailers("movie"),
                fetchTrailers("tv")
            ]);

            items.push(...movieItems, ...tvItems);

            // Remove duplicates (shouldn't happen but safety check)
            const uniqueItems = Array.from(
                new Map(items.map(item => [item.id, item])).values()
            );

            this.logger.log(`Page ${page}: Fetched ${uniqueItems.length} unique items before video enrichment`);

            // FIXED: Generate consistent seed per page (not time-based)
            // This ensures same page always returns same order
            const pageSeed = page * 12345;

            // Apply shuffling and quality scoring BEFORE enrichment
            const shuffled = this.shuffleUpcomingTrailers(uniqueItems, pageSeed);

            // FIXED: Request more items to account for filtering
            // We need to enrich more items than the limit to ensure we get enough valid videos
            const itemsToEnrich = shuffled.slice(0, Math.min(shuffled.length, limit * 2));
            const enrichedItems = await this.enrichWithVideos(itemsToEnrich, pageSeed);

            this.logger.log(`Page ${page}: ${enrichedItems.length} items with verified videos (from ${itemsToEnrich.length} candidates)`);

            // Take the requested limit from enriched results
            const paginatedResults = enrichedItems.slice(0, limit);

            // Determine if there's more content
            // If we got close to the limit after enrichment, there's likely more
            const hasMore = enrichedItems.length >= Math.floor(limit * 0.8) && uniqueItems.length >= limit;

            this.logger.log(`Page ${page}: Returning ${paginatedResults.length} results, hasMore: ${hasMore}`);

            const response = {
                results: paginatedResults,
                page,
                total_pages: 100, // Virtual total for infinite scroll
                hasMore
            };

            // Cache this page result
            // await this.redisService.set(pageCacheKey, JSON.stringify(response), ttlSec);

            // Populate recommendations in background (don't await)
            if (paginatedResults.length > 0) {
                setTimeout(async () => {
                    const tasks = paginatedResults.map(item => async () => {
                        try {
                            item.recommendations = await this.getSmartRecommendations(item.type!, item.id, 3);
                            return item;
                        } catch (err) {
                            this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                            return item;
                        }
                    });

                    await this.withConcurrencyLimit(tasks, 3);
                }, 100);
            }

            return response;
        } catch (err) {
            this.logger.error("Failed to fetch upcoming trailers feed", err as any);
            return { results: [], page, total_pages: 0, hasMore: false };
        }
    }

    /**
     * Shuffle upcoming trailers with quality-based tiering and randomization
     */
    private shuffleUpcomingTrailers(items: TmdbAll[], seed: number): TmdbAll[] {
        if (items.length === 0) return items;

        // Calculate quality score for each item
        const scoredItems = items.map(item => ({
            item,
            qualityScore: this.calculateUpcomingQualityScore(item),
            releaseDateScore: this.getReleaseDateProximityScore(item),
        }));

        // Sort by combined score with seeded randomization
        const jitter = 2.5; // Reduced randomness for more consistency

        const seededRandomForId = (id: number, offset = 0) => {
            const x = Math.sin((seed + offset) * 9301 + id * 49297) * 43758.5453123;
            return Math.abs(x - Math.floor(x));
        };

        scoredItems.sort((a, b) => {
            const scoreDiff = (b.qualityScore + b.releaseDateScore) - (a.qualityScore + a.releaseDateScore);

            // Add seeded randomization
            const randA = seededRandomForId(a.item.id);
            const randB = seededRandomForId(b.item.id);
            const randomFactor = (randB - randA) * jitter;

            return scoreDiff + randomFactor;
        });

        // Group into tiers after sorting
        const tiers = {
            premium: [] as TmdbAll[],
            high: [] as TmdbAll[],
            medium: [] as TmdbAll[],
        };

        scoredItems.forEach(scored => {
            const totalScore = scored.qualityScore + scored.releaseDateScore;
            if (totalScore >= 45) tiers.premium.push(scored.item);
            else if (totalScore >= 30) tiers.high.push(scored.item);
            else tiers.medium.push(scored.item);
        });

        // Mix tiers with weighted distribution
        const result: TmdbAll[] = [];
        let pIdx = 0, hIdx = 0, mIdx = 0;

        while (pIdx < tiers.premium.length || hIdx < tiers.high.length || mIdx < tiers.medium.length) {
            // 3 premium items
            for (let i = 0; i < 3 && pIdx < tiers.premium.length; i++) {
                result.push(tiers.premium[pIdx++]);
            }

            // 2 high quality items
            for (let i = 0; i < 2 && hIdx < tiers.high.length; i++) {
                result.push(tiers.high[hIdx++]);
            }

            // 1 medium quality item for variety
            if (mIdx < tiers.medium.length) {
                result.push(tiers.medium[mIdx++]);
            }
        }

        return result;
    }

    /**
     * Calculate quality score for upcoming trailers
     */
    private calculateUpcomingQualityScore(item: TmdbAll): number {
        let score = 0;

        // Popularity score (log scale)
        score += Math.log10((item.popularity || 1) + 1) * 10;

        // Rating score
        if (item.vote_average && item.vote_average > 0) {
            score += item.vote_average * 3;
        }

        // Vote count score (indicates buzz/anticipation)
        score += Math.log10((item.vote_count || 1) + 1) * 5;

        // Content quality indicators
        if (item.backdrop_path) score += 3;
        if (item.overview && item.overview.length > 100) score += 2;
        if (item.genres && item.genres.length > 0) score += 2;

        // Media type preference
        if (item.type === 'movie') score += 2;

        // Language diversity bonus
        if (item.original_language === 'en') score += 3;
        else if (['ko', 'ja', 'es', 'fr'].includes(item.original_language || '')) score += 4;

        return score;
    }

    /**
     * Score based on release date proximity (sooner releases score higher)
     */
    private getReleaseDateProximityScore(item: TmdbAll): number {
        if (!item.release_date) return 0;

        const releaseDate = new Date(item.release_date);
        const today = new Date();
        const daysUntilRelease = Math.floor((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Score based on proximity
        if (daysUntilRelease <= 14) return 12;       // Within 2 weeks
        if (daysUntilRelease <= 30) return 10;       // Within a month
        if (daysUntilRelease <= 60) return 8;        // Within 2 months
        if (daysUntilRelease <= 90) return 4;        // Within 3 months
        if (daysUntilRelease <= 180) return 2;       // Within 6 months

        return 0;
    }
}

// 9. IMPLEMENTATION GUIDE
/*
PERFORMANCE IMPROVEMENTS SUMMARY:

1. **Reduce API Calls**:
   - Batch video requests instead of sequential
   - Cache recommendations separately with longer TTL
   - Use background processing for heavy operations

2. **Smart Caching Strategy**:
   - Cache basic data immediately, populate details later
   - Use different TTL for different data types
   - Cache recommendation IDs vs full objects

3. **Concurrent Processing**:
   - Limit concurrent requests to respect TMDB rate limits
   - Use Promise.allSettled to handle failures gracefully
   - Process in batches to avoid memory issues

4. **Lazy Loading**:
   - Return basic trending data first
   - Load recommendations in background
   - Provide separate endpoints for detailed data

5. **Database Optimization**:
   - Use Redis pipelines for multiple operations
   - Implement proper cache invalidation
   - Consider Redis clustering for high traffic

IMPLEMENTATION PRIORITY:
1. Implement concurrent request limiting (immediate 50-70% improvement)
2. Add background recommendation processing (major UX improvement)
3. Optimize caching strategy (reduces redundant calls)
4. Add batch endpoints for frontend optimization
*/
