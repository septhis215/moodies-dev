import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { filter, firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';

export type TmdbGeneral = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    recommendations?: TmdbGeneral[];
    type: "movie" | "tv";
    // for trailers
    trailer_key?: string | null;
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
        media_type: "movie" | "tv";
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
export class GeneralService {
    private readonly logger = new Logger(GeneralService.name);
    private readonly base = 'https://api.themoviedb.org/3';
    private readonly apiKey = process.env.TMDB_API_KEY;
    // small in-memory cache to cut down calls in dev
    private cache: Record<string, { ts: number; data?: any[] }> = {};

    // Helper to get/set cache per key
    private getCache(key: string, ttl: number) {
        const entry = this.cache[key];
        if (entry && Date.now() - entry.ts < ttl) {
            return entry.data;
        }
        return null;
    }
    private setCache(key: string, data: any[]) {
        this.cache[key] = { ts: Date.now(), data };
    }

    constructor(private readonly http: HttpService) { }
    private genreMap: Record<number, string> = {};

    async loadGenres() {
        if (!this.apiKey) return;

        const endpoints = [
            `${this.base}/genre/movie/list`,
            `${this.base}/genre/tv/list`,
        ];

        for (const url of endpoints) {
            const resp = await firstValueFrom(
                this.http.get<any>(url, {
                    headers: { Authorization: `Bearer ${this.apiKey}` },
                }),
            );

            const genres = resp.data?.genres ?? [];
            for (const g of genres) {
                this.genreMap[g.id] = g.name;
            }
        }

        this.logger.log('Loaded genres:', Object.keys(this.genreMap).length);
    }

    async onModuleInit() {
        await this.loadGenres();
    }

    async getFeatured(limit = 30): Promise<TmdbGeneral[]> {
        const ttl = 1000 * 60 * 5; // 5 minutes cache
        const cacheKey = "featured";
        const cached = this.getCache(cacheKey, ttl);
        if (cached) return cached.slice(0, limit);

        if (!this.apiKey) {
            this.logger.warn('TMDB_API_KEY not set; returning empty list');
            return [];
        }

        // Correct TMDB trending endpoint with query string `?api_key=...`
        // use single ? for query string
        const url = `${this.base}/trending/all/day`;

        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }),
        );

        try {
            const results = resp.data?.results ?? [];
            const filtered = results.filter(
                (item: any) => item.media_type === "movie" || item.media_type === "tv"
            );
            const general: TmdbGeneral[] = results.map((m) => ({
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
                genres: m.genre_ids ? m.genre_ids.map((id: number) => this.genreMap[id] || "Unknown") : [],
            }));


            // cache the full sliced list (we cache the sliced list to keep memory small)
            const shuffled = shuffleArray(general);
            const sliced = shuffled.slice(0, Math.max(0, limit));
            this.setCache(cacheKey, sliced);

            return sliced;
        } catch (err) {
            this.logger.error('Failed to fetch TMDB trending', err as any);
            return [];
        }
    }

    async getTrending(limit = 30): Promise<TmdbGeneral[]> {
        const ttl = 1000 * 60 * 5; // 5 minutes cache

        const cacheKey = "trending";
        const cached = this.getCache(cacheKey, ttl);
        if (cached) return cached.slice(0, limit);
        if (!this.apiKey) {
            this.logger.warn('TMDB_API_KEY not set; returning empty list');
            return [];
        }
        const url = `${this.base}/trending/all/day`;

        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }),
        );

        try {
            const results = resp.data?.results ?? [];
            const general: TmdbGeneral[] = [];

            for (const m of results.slice(0, limit)) {
                // Ensure we only handle movie/tv (ignore persons if any)
                if (m.media_type !== "movie" && m.media_type !== "tv") continue;

                const item: TmdbGeneral = {
                    id: m.id,
                    title: m.title ?? m.name ?? "Untitled",
                    overview: m.overview ?? "",
                    poster_path: m.poster_path ?? null,
                    backdrop_path: m.backdrop_path ?? null,
                    release_date: m.release_date ?? m.first_air_date ?? null,
                    vote_average: m.vote_average,
                    vote_count: m.vote_count,
                    popularity: m.popularity,
                    origin_country: m.origin_country ?? [],
                    genres: m.genre_ids
                        ? m.genre_ids.map((id: number) => this.genreMap[id] || "Unknown")
                        : [],
                    type: m.media_type,
                    recommendations: await this.getRecommendations(m.media_type, m.id, 5),
                };

                general.push(item);
            }



            this.setCache(cacheKey, general);
            const shuffled = shuffleArray(general);
            const sliced = shuffled.slice(0, Math.max(0, limit));
            return sliced;
        } catch (err) {
            this.logger.error("Failed to fetch TMDB trending", err as any);
            return [];
        }
    }

    async getTrailers(limit = 30): Promise<TmdbGeneral[]> {
        if (!this.apiKey) {
            this.logger.warn("TMDB_API_KEY not set; returning empty list");
            return [];
        }

        // Korean TV shows
        const url = `${this.base}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1`;
        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }),
        );

        try {
            const results = resp.data?.results ?? [];

            const withTrailers = await Promise.all(
                results.slice(0, limit).map(async (m) => {
                    try {
                        // `media_type` may not exist → fallback to "tv"
                        const type = m.media_type ?? "tv";
                        const videosUrl = `${this.base}/${type}/${m.id}/videos?language=en-US`;

                        const videosResp = await firstValueFrom(
                            this.http.get<any>(videosUrl, {
                                headers: { Authorization: `Bearer ${this.apiKey}` },
                            }),
                        );

                        const trailer = videosResp.data.results.find(
                            (v: any) =>
                                v.type === "Trailer" &&
                                v.site === "YouTube"
                        );

                        return {
                            id: m.id,
                            title: m.title ?? m.name ?? "Untitled",
                            overview: m.overview ?? "",
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: m.release_date ?? m.first_air_date ?? null,
                            vote_average: m.vote_average,
                            trailer_key: trailer ? trailer.key : null,
                        };
                    } catch {
                        return {
                            id: m.id,
                            title: m.title ?? m.name ?? "Untitled",
                            overview: m.overview ?? "",
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: m.release_date ?? m.first_air_date ?? null,
                            vote_average: m.vote_average,
                            trailer_key: null,
                        };
                    }
                })
            );

            return withTrailers;
        } catch (err) {
            this.logger.error("Failed to fetch TMDB trailers", err as any);
            return [];
        }
    }

    async getFavorites(limit = 30): Promise<TmdbGeneral[]> {
        const ttl = 1000 * 60 * 5; // 5 minutes cache

        const cacheKey = "favorites";
        const cached = this.getCache(cacheKey, ttl);
        if (cached) return cached.slice(0, limit);
        if (!this.apiKey) {
            this.logger.warn('TMDB_API_KEY not set; returning empty list');
            return [];
        }
        const url = `${this.base}/trending/all/day`;

        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }),
        );

        try {
            const results = resp.data?.results ?? [];
            const filtered = results.filter(
                (item: any) => item.media_type === "movie" || item.media_type === "tv"
            );
            const general: TmdbGeneral[] = filtered.map((m) => ({
                id: m.id,
                title: m.title ?? m.name ?? "Untitled",
                overview: m.overview ?? "",
                genres: m.genre_ids ? m.genre_ids.map((id: number) => this.genreMap[id] || "Unknown") : [],
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date ?? m.first_air_date ?? null,
                vote_average: m.vote_average,
            }));


            // cache the full sliced list (we cache the sliced list to keep memory small)
            const shuffled = shuffleArray(general);
            const sliced = shuffled.slice(0, Math.max(0, limit));
            this.setCache(cacheKey, sliced);
            return sliced;
        } catch (err) {
            this.logger.error('Failed to fetch TMDB trending', err as any);
            return [];
        }
    }
    async getKoreaTrending(limit = 30): Promise<TmdbGeneral[]> {
        const ttl = 1000 * 60 * 5; // 5 min cache
        const cacheKey = "koreaTrending";
        const cached = this.getCache(cacheKey, ttl);
        if (cached) return cached.slice(0, limit);

        if (!this.apiKey) {
            this.logger.warn("TMDB_API_KEY not set; returning empty list");
            return [];
        }

        const url = `${this.base}/discover/tv?with_original_language=ko&include_adult=false&sort_by=popularity.desc&page=1`;

        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: { Authorization: `Bearer ${this.apiKey}` },
            }),
        );

        try {
            const results = resp.data?.results ?? [];
            const general: TmdbGeneral[] = [];

            for (const m of results.slice(0, limit)) {
                const item: TmdbGeneral = {
                    id: m.id,
                    title: m.title ?? m.name ?? "Untitled",
                    overview: m.overview ?? "",
                    poster_path: m.poster_path ?? null,
                    backdrop_path: m.backdrop_path ?? null,
                    release_date: m.release_date ?? m.first_air_date ?? null,
                    vote_average: m.vote_average,
                    vote_count: m.vote_count,
                    popularity: m.popularity,
                    origin_country: m.origin_country ?? [],
                    genres: m.genre_ids
                        ? m.genre_ids.map((id: number) => this.genreMap[id] || "Unknown")
                        : [],
                    recommendations: await this.getRecommendations("tv", m.id, 5),
                    type: "tv",
                };

                general.push(item);
            }

            this.setCache(cacheKey, general);
            const shuffled = shuffleArray(general);
            const sliced = shuffled.slice(0, Math.max(0, limit));
            return sliced;
        } catch (err) {
            this.logger.error("Failed to fetch TMDB trending", err as any);
            return [];
        }
    }


    async getRecommendations(
        type: "movie" | "tv",
        id: number,
        limit = 10
    ): Promise<TmdbGeneral[]> {
        const ttl = 1000 * 60 * 10; // 10 minutes cache
        const cacheKey = `${type}-${id}-recommendations`;

        const cached = this.getCache(cacheKey, ttl);
        if (cached) return cached.slice(0, limit);

        if (!this.apiKey) {
            this.logger.warn("TMDB_API_KEY not set; returning empty recommendations");
            return [];
        }

        const url = `${this.base}/${type}/${id}/recommendations?language=en-US&page=1`;

        try {
            const resp = await firstValueFrom(
                this.http.get<any>(url, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                })
            );

            const results = resp.data?.results ?? [];
            const recs: TmdbGeneral[] = results.map((m: any) => ({
                id: m.id,
                title: m.title ?? m.name ?? "Untitled",
                overview: m.overview ?? "",
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: m.release_date ?? m.first_air_date ?? null,
                vote_average: m.vote_average,
                vote_count: m.vote_count,
                popularity: m.popularity,
                origin_country: m.origin_country ?? [],
                genres: m.genre_ids
                    ? m.genre_ids.map((id: number) => this.genreMap[id] || "Unknown")
                    : [],
            }));

            const sliced = recs.slice(0, Math.max(0, limit));
            this.setCache(cacheKey, sliced);
            return sliced;
        } catch (err) {
            this.logger.error("Failed to fetch TMDB recommendations", err as any);
            return [];
        }
    }

    async getPeople(limit = 30): Promise<TmdbPerson[]> {
        const ttl = 1000 * 60 * 5; // 5 minutes cache
        const cacheKey = `people-${limit}`;

        const cached = this.getCache(cacheKey, ttl);
        if (cached) return cached.slice(0, limit);

        if (!this.apiKey) {
            this.logger.warn('TMDB_API_KEY not set; returning empty list');
            return [];
        }

        const url = `${this.base}/person/popular?include_adult=false&page=1`;

        const resp = await firstValueFrom(
            this.http.get<any>(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }),
        );

        try {
            const results = resp.data?.results ?? [];

            const people: TmdbPerson[] = results.map((m: any) => ({
                id: m.id,
                name: m.name ?? "Unknown",
                known_for_department: m.known_for_department,
                profile_path: m.profile_path ?? null,
                popularity: m.popularity ?? 0,
                known_for: m.known_for?.map((kf: any) => ({
                    id: kf.id,
                    title: kf.title,
                    name: kf.name,
                    media_type: kf.media_type,
                    poster_path: kf.poster_path ?? null,
                    overview: kf.overview,
                })),
            }));

            const sliced = people.slice(0, Math.max(0, limit));
            this.setCache(cacheKey, sliced);

            return sliced;
        } catch (err) {
            this.logger.error("Failed to fetch TMDB popular people", err as any);
            return [];
        }
    }

}
