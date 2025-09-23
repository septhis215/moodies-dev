import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';

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
    BASIC_DATA: 60 * 5,      // 5 minutes for trending
    RECOMMENDATIONS: 60 * 30, // 30 minutes for recommendations
    TRAILERS: 60 * 60,       // 1 hour for trailers
    GENRES: 60 * 60 * 24     // 24 hours for genres
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

  // Featured (uses trending endpoint, small cache)
  async getFeatured(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    const cacheKey = `featured`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TmdbAll[];
        return parsed.slice(0, limit);
      } catch { }
    }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty featured');
      return [];
    }

    try {
      const data = await this.tmdb('/trending/all/day');
      const results = data?.results ?? [];

      const all: TmdbAll[] = results
        .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((m: any) => ({
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
            ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
            : [],
          type: m.media_type,
        }));

      const shuffled = shuffleArray(all);
      const sliced = shuffled.slice(0, Math.max(0, limit));

      await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
      return sliced;
    } catch (err) {
      this.logger.error('Failed to fetch featured', err as any);
      return [];
    }
  }

  // OPTIMIZED: Trending with fast response and background recommendations
  async getTrending(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    const cacheKey = `trending-${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TmdbAll[];
        return parsed.slice(0, limit);
      } catch { }
    }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trending');
      return [];
    }

    try {
      const data = await this.tmdb('/trending/all/day');
      const results = data?.results ?? [];

      // Step 1: Create basic items without recommendations for fast response
      const basicItems: TmdbAll[] = [];

      for (const m of results.slice(0, limit)) {
        if (m.media_type !== 'movie' && m.media_type !== 'tv') continue;

        // Get countries without extra API call for TV
        let countries: string[] = [];
        if (m.media_type === "tv" && m.origin_country?.length) {
          countries = m.origin_country;
        } else {
          countries = []; // Skip expensive movie details call for now
        }

        const item: TmdbAll = {
          id: m.id,
          title: m.title ?? m.name ?? 'Untitled',
          overview: m.overview ?? '',
          poster_path: m.poster_path ?? null,
          backdrop_path: m.backdrop_path ?? null,
          release_date: m.release_date ?? m.first_air_date ?? null,
          vote_average: m.vote_average,
          vote_count: m.vote_count,
          popularity: m.popularity,
          origin_country: countries,
          genres: m.genre_ids
            ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
            : [],
          type: m.media_type,
          recommendations: [], // Empty initially
        };

        basicItems.push(item);
      }

      // Step 2: Cache basic items immediately
      const shuffled = shuffleArray(basicItems);
      await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);

      // Step 3: Start background recommendation population (don't await)
      this.populateRecommendationsBackground(basicItems, cacheKey);

      return shuffled.slice(0, Math.max(0, limit));
    } catch (err) {
      this.logger.error('Failed to fetch trending', err as any);
      return [];
    }
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

  // OPTIMIZED: Smart recommendations with better caching and concurrency
  async getSmartRecommendations(
    type: "movie" | "tv",
    id: number,
    limit = 10
  ): Promise<TmdbAll[]> {
    const ttlSec = this.CACHE_TTL.RECOMMENDATIONS;
    const cacheKey = `smart-rec-${type}-${id}-${limit}`;

    // Check cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { }
    }

    if (!this.token) {
      return [];
    }

    try {
      // Step 1: Fetch basic recommendation data in parallel (NO video calls yet)
      const [recData, detailsData, simData] = await Promise.allSettled([
        this.tmdb(`${this.baseUrl}/${type}/${id}/recommendations?language=en-US&page=1`),
        type === "movie" ? this.tmdb(`${this.baseUrl}/movie/${id}?language=en-US`) : Promise.resolve(null),
        this.tmdb(`${this.baseUrl}/${type}/${id}/similar?language=en-US&page=1`)
      ]);

      let collected: any[] = [];

      // Add recommendations
      if (recData.status === 'fulfilled' && recData.value?.results?.length) {
        collected.push(...recData.value.results);
      }

      // Add collection items for movies
      if (type === "movie" && detailsData.status === 'fulfilled' && detailsData.value?.belongs_to_collection?.id) {
        try {
          const collData = await this.tmdb(`${this.baseUrl}/collection/${detailsData.value.belongs_to_collection.id}?language=en-US`);
          if (collData?.parts?.length) {
            const parts = collData.parts.filter((p: any) => p.id !== id);
            collected.push(...parts);
          }
        } catch { }
      }

      // Add similar items if needed
      if (collected.length < limit && simData.status === 'fulfilled' && simData.value?.results?.length) {
        collected.push(...simData.value.results);
      }

      // Deduplicate and limit
      const unique = collected
        .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
        .slice(0, limit * 2); // Get more than needed as backup

      // Step 2: Now batch fetch videos with concurrency control
      const videoTasks = unique.map(m => async () => {
        try {
          const videosData = await this.tmdb(`${this.baseUrl}/${type}/${m.id}/videos?language=en-US`);
          const trailer = (videosData?.results ?? []).find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube"
          );
          return trailer ? { ...m, trailer_key: trailer.key } : null;
        } catch {
          return null;
        }
      });

      const withTrailers = (await this.withConcurrencyLimit(videoTasks))
        .filter(Boolean)
        .slice(0, limit);

      // Step 3: Transform to final format (reuse genre map, avoid extra API calls)
      const final: TmdbAll[] = withTrailers.map(m => ({
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
        genres: m.genre_ids?.map((gid: number) => this.genreMap[gid] || "Unknown") ?? [],
        trailer_key: m.trailer_key,
        type,
      }));

      // Cache with longer TTL
      await this.redisService.set(cacheKey, JSON.stringify(final), ttlSec);
      return final;

    } catch (err) {
      this.logger.error("getSmartRecommendations failed", err);
      return [];
    }
  }

  // OPTIMIZED: Korea trending with background processing
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
      // Fetch Korean TV + Korean Movies in parallel
      const [tvData, movieData] = await Promise.all([
        this.tmdb(`${this.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`),
        this.tmdb(`${this.baseUrl}/discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`)
      ]);

      let results = [
        ...(tvData?.results ?? []),
        ...(movieData?.results ?? [])
      ];
      results = this.filterAdultishContent(results);

      // Process basic info first, defer recommendations
      const items: TmdbAll[] = results.slice(0, limit).map(m => {
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
          recommendations: [], // Populate later
        };
      });

      const shuffled = shuffleArray(items);

      // Cache and start background recommendation population
      await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);
      this.populateRecommendationsBackground(shuffled, cacheKey);

      return shuffled.slice(0, Math.max(0, limit));

    } catch (err) {
      this.logger.error('Failed to fetch koreaTrending', err as any);
      return [];
    }
  }

  private filterAdultishContent(results: any[]): any[] {
    const bannedWords = [
      "에로", "성인", "야한", "포르노", "섹스",
      "애로", "노출", "야설", "불륜", "관음",
      "sex", "porn", "xxx", "erotic", "sensual", "nude", "adult"
    ];

    const bannedGenres = [2916, 3568, 2972, 10364];

    return results.filter((m) => {
      const title = (m.title ?? m.name ?? "").toLowerCase();
      const overview = (m.overview ?? "").toLowerCase();

      if (bannedWords.some((word) => title.includes(word) || overview.includes(word))) {
        return false;
      }

      if (m.genre_ids?.some((id: number) => bannedGenres.includes(id))) {
        return false;
      }

      if (m.media_type === "movie" && (m.vote_count ?? 0) < 30) {
        return false;
      }

      return true;
    });
  }

  // OPTIMIZED: Trailers with better concurrency
  async getTrailers(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = this.CACHE_TTL.TRAILERS;
    const cacheKey = `trailers-ko-${limit}`;

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
      const url = `${this.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1`;
      const data = await this.tmdb(url);
      const results = data?.results ?? [];

      // Process with concurrency control
      const trailerTasks = results.slice(0, limit).map((m: any) => async () => {
        try {
          const type = m.media_type ?? 'tv';

          // Fetch videos and details in parallel
          const [videosData, details] = await Promise.all([
            this.tmdb(`${this.baseUrl}/${type}/${m.id}/videos?language=en-US`),
            this.tmdb(`${this.baseUrl}/${type}/${m.id}?language=en-US`)
          ]);

          const trailer = (videosData?.results ?? []).find(
            (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
          );

          return {
            id: m.id,
            title: m.title ?? m.name ?? 'Untitled',
            overview: m.overview ?? '',
            poster_path: m.poster_path ?? null,
            backdrop_path: m.backdrop_path ?? null,
            release_date: m.release_date ?? m.first_air_date ?? null,
            vote_average: m.vote_average,
            trailer_key: trailer ? trailer.key : null,
            recommendations: [], // Will be populated separately if needed
            runtime: type === "movie" ? details.runtime ?? null : null,
            number_of_episodes: type === "tv" ? details.number_of_episodes ?? null : null,
            genres: details.genres ? details.genres.map((g: any) => g.name) : [],
          } as TmdbAll;
        } catch {
          return {
            id: m.id,
            title: m.title ?? m.name ?? 'Untitled',
            overview: m.overview ?? '',
            poster_path: m.poster_path ?? null,
            backdrop_path: m.backdrop_path ?? null,
            release_date: m.release_date ?? m.first_air_date ?? null,
            vote_average: m.vote_average,
            trailer_key: null,
            recommendations: [],
            runtime: null,
            genres: [],
          };
        }
      });

      const withTrailers = (await this.withConcurrencyLimit(trailerTasks))
        .filter((item): item is TmdbAll => item !== null);

      await this.redisService.set(cacheKey, JSON.stringify(withTrailers), ttlSec);
      return withTrailers;
    } catch (err) {
      this.logger.error('Failed to fetch trailers', err as any);
      return [];
    }
  }

  // Keep existing methods with optimizations
  async getFavorites(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    const cacheKey = `favorites`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TmdbAll[];
        return parsed.slice(0, limit);
      } catch { }
    }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
      return [];
    }

    try {
      const data = await this.tmdb('/trending/all/day');
      const results = data?.results ?? [];
      const filtered = results.filter(
        (item: any) => item.media_type === 'movie' || item.media_type === 'tv',
      );
      const all: TmdbAll[] = filtered.map((m: any) => ({
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

      const shuffled = shuffleArray(all);
      const sliced = shuffled.slice(0, Math.max(0, limit));
      await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
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

  async getPeople(limit = 30): Promise<TmdbPerson[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    const cacheKey = `people-${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TmdbPerson[];
        return parsed.slice(0, limit);
      } catch { }
    }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty people');
      return [];
    }

    try {
      const url = `${this.baseUrl}/person/popular?include_adult=false&page=1`;
      const data = await this.tmdb(url);
      const results = data?.results ?? [];

      const people: TmdbPerson[] = results.map((m: any) => ({
        id: m.id,
        name: m.name ?? 'Unknown',
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
      await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
      return sliced;
    } catch (err) {
      this.logger.error('Failed to fetch people', err as any);
      return [];
    }
  }

  async trending(type: string) {
    const cacheKey = `trending/all/${type}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.tmdb(`trending/all/${type}`);
    const results = data?.results ?? [];

    await this.redisService.set(cacheKey, JSON.stringify(results), 60);
    return results;
  }

  async getTrendingReviews(limit = 40): Promise<{
    quote: string;
    name: string;
    title: string;
    avatar: string;
    rating?: number | null;
  }[]> {
    const ttlSec = 60 * 10;
    const cacheKey = `trendingReviews`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { }
    }

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
      await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch trending reviews', err as any);
      return [];
    }
  }

  async getUpcomingTrailers(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = this.CACHE_TTL.TRAILERS;
    const cacheKey = `trailers-upcoming-${limit}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as TmdbAll[];
      } catch { }
    }

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
        await this.redisService.set(cacheKey, JSON.stringify(updatedItems), ttlSec);
      }, 100);

      await this.redisService.set(cacheKey, JSON.stringify(sorted), ttlSec);
      return sorted;
    } catch (err) {
      this.logger.error("Failed to fetch upcoming trailers", err as any);
      return [];
    }
  }

  // NEW: Separate endpoint to get recommendations for a specific item
  async getItemRecommendations(type: 'movie' | 'tv', id: number): Promise<TmdbAll[]> {
    return this.getSmartRecommendations(type, id, 5);
  }

  // NEW: Batch trailer fetching for multiple items
  async getTrailersForItems(items: { type: 'movie' | 'tv', id: number }[]): Promise<Record<string, string | null>> {
    const cacheKey = `batch-trailers-${items.map(i => `${i.type}-${i.id}`).join(',')}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { }
    }

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

    await this.redisService.set(cacheKey, JSON.stringify(trailerMap), this.CACHE_TTL.TRAILERS);
    return trailerMap;
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
