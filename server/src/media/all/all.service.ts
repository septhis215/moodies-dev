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
    const ttlSec = 60 * 5; // 5 minutes
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
          origin_country: m.origin_country ?? [],
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

  // Trending with recommendations
  async getTrending(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = 60 * 5; // 5 minutes
    const cacheKey = `trending`;
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

      const all: TmdbAll[] = [];

      for (const m of results.slice(0, limit)) {
        if (m.media_type !== 'movie' && m.media_type !== 'tv') continue;

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
          origin_country: m.origin_country ?? [],
          genres: m.genre_ids
            ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
            : [],
          type: m.media_type,
          recommendations: await this.getRecommendations(m.media_type, m.id, 5),
        };

        all.push(item);
      }

      await this.redisService.set(cacheKey, JSON.stringify(all), ttlSec);
      const shuffled = shuffleArray(all);
      return shuffled.slice(0, Math.max(0, limit));
    } catch (err) {
      this.logger.error('Failed to fetch trending', err as any);
      return [];
    }
  }

  // Trailers (Korean TV discover -> attach trailer key)
  async getTrailers(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = 60 * 5; // 5 minutes
    const cacheKey = `trailers-ko-${limit}`;

    // try redis first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TmdbAll[];
        return parsed;
      } catch {
        // fall through to fetch if parse fails
      }
    }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      const url = `${this.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1`;
      const data = await this.tmdb(url);
      const results = data?.results ?? [];

      const withTrailers = await Promise.all(
        results.slice(0, limit).map(async (m: any) => {
          try {
            const type = m.media_type ?? 'tv';
            const videosUrl = `${this.baseUrl}/${type}/${m.id}/videos?language=en-US`;
            const videosData = await this.tmdb(videosUrl);
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
            } as TmdbAll;
          }
        }),
      );

      // cache the result to reduce TMDB calls
      await this.redisService.set(
        cacheKey,
        JSON.stringify(withTrailers),
        ttlSec,
      );

      return withTrailers;
    } catch (err) {
      this.logger.error('Failed to fetch trailers', err as any);
      return [];
    }
  }

  // Favorites - similar to featured
  async getFavorites(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = 60 * 5;
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

  // Korea trending (discover)
  async getKoreaTrending(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = 60 * 5;
    const cacheKey = `koreaTrending`;
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
      const url = `${this.baseUrl}/discover/tv?with_original_language=ko&include_adult=false&sort_by=popularity.desc&page=1`;
      const data = await this.tmdb(url);
      const results = data?.results ?? [];

      const all: TmdbAll[] = [];
      for (const m of results.slice(0, limit)) {
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
          origin_country: m.origin_country ?? [],
          genres: m.genre_ids
            ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
            : [],
          recommendations: await this.getRecommendations('tv', m.id, 5),
          type: 'tv',
        };
        all.push(item);
      }

      await this.redisService.set(cacheKey, JSON.stringify(all), ttlSec);
      const shuffled = shuffleArray(all);
      return shuffled.slice(0, Math.max(0, limit));
    } catch (err) {
      this.logger.error('Failed to fetch koreaTrending', err as any);
      return [];
    }
  }

  // Recommendations
  async getRecommendations(type: 'movie' | 'tv', id: number, limit = 10): Promise<TmdbAll[]> {
    const ttlSec = 60 * 10;
    const cacheKey = `${type}-${id}-recommendations`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as TmdbAll[];
      } catch { }
    }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty recommendations');
      return [];
    }

    try {
      const url = `${this.baseUrl}/${type}/${id}/recommendations?language=en-US&page=1`;
      const data = await this.tmdb(url);
      const results = data?.results ?? [];

      const recs: TmdbAll[] = [];
      for (const m of results) {
        const rd = m.release_date ?? m.first_air_date;
        if (!rd) continue;

        const videosUrl = `${this.baseUrl}/${type}/${m.id}/videos?language=en-US`;
        const videosData = await this.tmdb(videosUrl);
        const trailer = (videosData?.results ?? []).find(
          (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
        );
        if (!trailer) continue;

        recs.push({
          id: m.id,
          title: m.title ?? m.name ?? 'Untitled',
          overview: m.overview ?? '',
          poster_path: m.poster_path ?? null,
          backdrop_path: m.backdrop_path ?? null,
          release_date: rd,
          vote_average: m.vote_average,
          trailer_key: trailer.key,
          vote_count: m.vote_count,
          popularity: m.popularity,
          origin_country: m.origin_country ?? [],
          genres: m.genre_ids
            ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
            : [],
          type,
        } as TmdbAll);

        if (recs.length >= limit) break;
      }

      await this.redisService.set(cacheKey, JSON.stringify(recs), ttlSec);
      return recs;
    } catch (err) {
      this.logger.error('Failed to fetch recommendations', err as any);
      return [];
    }
  }


  // People
  async getPeople(limit = 30): Promise<TmdbPerson[]> {
    const ttlSec = 60 * 5;
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

  // Keep your existing trending() method as a thin wrapper if you need it elsewhere
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

  // tmdb.service.ts

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

      const trendingPages = 3; // pages of trending content
      const reviewPages = 3;   // pages of reviews per item

      // Fetch trending pages sequentially
      for (let p = 1; p <= trendingPages; p++) {
        const trendingData = await this.tmdb(`${this.baseUrl}/trending/all/week?language=en-US&page=${p}`);
        const results = trendingData?.results ?? [];

        for (const item of results) {
          if (reviews.length >= limit) break;

          // Fetch review pages concurrently
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

      // Shuffle and cache
      const shuffled = reviews.sort(() => Math.random() - 0.5);
      await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch trending reviews', err as any);
      return [];
    }
  }
  async getUpcomingTrailers(limit = 30): Promise<TmdbAll[]> {
    const ttlSec = 60 * 5; // 5 minutes
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
      const maxPages = 20; // increase if needed to ensure enough trailers

      const fetchTrailers = async (mediaType: "movie" | "tv") => {
        for (let page = 1; page <= maxPages; page++) {
          let url: string;
          if (mediaType === "movie") {
            // Discover upcoming movies sorted by popularity
            const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
            url = `${this.baseUrl}/discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`;
          } else {
            // Discover TV shows currently airing
            const todayStr = today.toISOString().split("T")[0];
            url = `${this.baseUrl}/discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${page}`;
          }

          const data = await this.tmdb(url);
          const results = data?.results ?? [];

          for (const m of results) {
            const rd = m.release_date ?? m.first_air_date;
            if (!rd || new Date(rd) < today) continue;

            try {
              const videosUrl = `${this.baseUrl}/${mediaType}/${m.id}/videos?language=en-US`;
              const videosData = await this.tmdb(videosUrl);

              // Only take items with a YouTube trailer
              const trailer = (videosData?.results ?? []).find(
                (v: any) => v.type === "Trailer" && v.site === "YouTube"
              );
              if (!trailer) continue;

              items.push({
                id: m.id,
                title: m.title ?? m.name ?? "Untitled",
                overview: m.overview ?? "",
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: rd,
                vote_average: m.vote_average,
                trailer_key: trailer.key,
                type: mediaType,
                recommendations: await this.getRecommendations(mediaType, m.id, 3),
              } as TmdbAll);

              if (items.length >= limit) break;
            } catch {
              // skip if videos fetch fails
              continue;
            }
          }

          if (items.length >= limit) break;
        }
      };

      // Fetch movies and TV concurrently
      await Promise.all([fetchTrailers("movie"), fetchTrailers("tv")]);

      // Sort by release date ascending and trim to limit
      const sorted = items
        .sort((a, b) => {
          const da = a.release_date ? new Date(a.release_date).getTime() : Infinity;
          const db = b.release_date ? new Date(b.release_date).getTime() : Infinity;
          return da - db;
        })
        .slice(0, limit);

      await this.redisService.set(cacheKey, JSON.stringify(sorted), ttlSec);
      const shuffled = sorted.sort(() => Math.random() - 0.5);
      return shuffled;
    } catch (err) {
      this.logger.error("Failed to fetch upcoming trailers", err as any);
      return [];
    }
  }

}