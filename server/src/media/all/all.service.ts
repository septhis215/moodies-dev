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

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

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
        const normalizedEndpoint = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const response = await firstValueFrom(
            this.httpService.get(normalizedEndpoint, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/json',
                },
            }),
        );

        return response.data;
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
            // Get trending but only recent ones
            const data = await this.tmdb(
                `/trending/all/day?include_adult=false`
            );

            const results = (data?.results ?? []).filter((m: any) => {
                const date = new Date(m.release_date ?? m.first_air_date ?? '');
                return date >= new Date(this.getRecentDate(365)); // last 12 months
            });
            const uniqueItems = Array.from(
                new Map(results.map((item) => [item.id, item])).values()
            );
            const basicItems: TmdbAll[] = uniqueItems.slice(0, limit).map((m: any) => ({
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
                genres: m.genre_ids ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown') : [],
                type: m.media_type,
                recommendations: [],
            }));

            const shuffled = shuffleArray(basicItems);
            await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);

            // populate recommendations in background
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
            // Deduplicate by ID while preserving order (Korean content first)
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
                    const type = m.media_type; // Focus on TV series

                    // Fetch videos, details, and additional info in parallel
                    const [videosData, details] = await Promise.all([
                        this.tmdb(`${this.baseUrl}/${type}/${m.id}/videos?language=en-US`),
                        this.tmdb(`${this.baseUrl}/${type}/${m.id}?language=en-US`).catch(() => null)
                    ]);

                    // Enhanced trailer finding - look for multiple types
                    const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
                    let trailer: any = null;

                    for (const trailerType of trailerTypes) {
                        trailer = (videosData?.results ?? []).find(
                            (v: any) => v.type === trailerType && v.site === 'YouTube'
                        );
                        if (trailer) break;
                    }

                    // Only return items that have trailers
                    if (!trailer) return null;

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
                        trailer_key: trailer.key,
                        recommendations: [], // Will be populated in background
                        runtime: undefined, // Use undefined instead of null for TV
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

            // Cache the results
            // await this.redisService.set(cacheKey, JSON.stringify(withTrailers), ttlSec);
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

        // const cached = await this.redisService.get(cacheKey);
        // if (cached) {
        //     try {
        //         return JSON.parse(cached) as TmdbAll[];
        //     } catch { }
        // }

        if (!this.token) {
            this.logger.warn("TMDB_API_KEY not set; returning empty trailers");
            return [];
        }

        try {
            const items: TmdbAll[] = [];
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
            const maxPages = 20;

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

                            const trailer = (videosData?.results ?? []).find(
                                (v: any) => v.type === "Trailer" && v.site === "YouTube"
                            );
                            if (!trailer) return null;

                            return {
                                id: m.id,
                                title: m.title ?? m.name ?? "Untitled",
                                overview: m.overview ?? "",
                                poster_path: m.poster_path ?? null,
                                backdrop_path: m.backdrop_path ?? null,
                                release_date: rd,
                                vote_average: m.vote_average,
                                trailer_key: trailer.key,
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

            // Populate recommendations in background (don't await)
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

                const updatedItems = await this.withConcurrencyLimit(tasks, 3);
                // await this.redisService.set(cacheKey, JSON.stringify(updatedItems), ttlSec);
            }, 100);

            // await this.redisService.set(cacheKey, JSON.stringify(sorted), ttlSec);
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
