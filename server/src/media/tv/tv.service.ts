import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// import { RedisService } from 'src/redis/redis.service';

type ContentType = 'tv';

// Reuse the types from all.service.ts
export type TmdbTv = {
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
  recommendations?: TmdbTv[];
  type: ContentType;
  trailer_key?: string | null;
  network?: string;
  created_by?: string;
  genre_ids?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  first_air_date?: string | null;
  last_air_date?: string | null;
  status?: string;
  runtime?: number;
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
export class TvService implements OnModuleInit {
  private readonly logger = new Logger(TvService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private genreMap: Record<number, string> = {};
  private readonly maxConcurrentRequests = 5;

  // Cache TTL constants
  private readonly CACHE_TTL = {
    BASIC_DATA: 60 * 5, // 5 minutes for trending
    RECOMMENDATIONS: 60 * 30, // 30 minutes for recommendations
    TRAILERS: 60 * 60, // 1 hour for trailers
    GENRES: 60 * 60 * 24, // 24 hours for genres
  };

  constructor(
    private readonly httpService: HttpService,
    // private readonly redisService: RedisService,
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
    limit: number = this.maxConcurrentRequests,
  ): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < tasks.length; i += limit) {
      const batch = tasks.slice(i, i + limit);
      const batchResults = await Promise.allSettled(
        batch.map((task) => task()),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }
    return results;
  }

  // Generic helper: returns response.data
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

  // Private fetch methods for TV (matching movies service pattern)
  private async fetchInfo(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}?language=en-US`);
  }

  private async fetchCredits(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}/aggregate_credits?language=en-US`);
  }

  private async fetchVideos(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}/videos?language=en-US`);
  }

  private async fetchProviders(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}/watch/providers`);
  }

  private async fetchReviews(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}/reviews?language=en-US&page=1`);
  }

  private async fetchSimilar(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}/similar?language=en-US&page=1`);
  }

  private async fetchContentRatings(id: number, type: ContentType = 'tv') {
    return await this.tmdb(`${type}/${id}/content_ratings`);
  }

  // Main TV details method - matches movies service exactly
  async tvDetails(id: number, p0: any) {
    // const cacheKey = `tv/details/${id}`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //   try {
    //     return JSON.parse(cached);
    //   } catch (err) {
    //     this.logger.warn('Failed to parse cached tv details, will refetch', err);
    //   }
    // }

    const detectedType: ContentType = 'tv';

    // fetch in parallel from the appropriate endpoints
    const [
      infoRaw,
      creditsRaw,
      videosRaw,
      providersRaw,
      reviewsRaw,
      similarRaw,
      contentRatingsRaw,
    ] = await Promise.all([
      this.fetchInfo(id, detectedType),
      this.fetchCredits(id, detectedType),
      this.fetchVideos(id, detectedType),
      this.fetchProviders(id, detectedType),
      this.fetchReviews(id, detectedType),
      this.fetchSimilar(id, detectedType),
      this.fetchContentRatings(id, detectedType),
    ]);

    // build trailer if available
    const videos = videosRaw?.results ?? videosRaw ?? [];
    const trailer =
      (videos || []).find(
        (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
      ) ?? null;

    // normalise production countries for tv (uses origin_country)
    const production_countries =
      infoRaw?.production_countries ??
      (infoRaw?.origin_country
        ? (infoRaw.origin_country as string[]).map((c) => ({ iso_3166_1: c }))
        : []);

    // creator (TV equivalent of director)
    const director =
      (creditsRaw?.crew ?? []).find((c: any) => c.job === 'Director')?.name ??
      (infoRaw?.created_by && infoRaw.created_by[0]?.name) ??
      undefined;

    // Process content ratings to get standardized age rating
    // TV-only: prefer US, then fallback to other common countries, then any available rating
    const getContentRating = (
      ratingsData: any,
      fallbackCountries: string[] = ['GB', 'CA', 'AU', 'FR', 'DE', 'IN', 'JP'],
    ): string => {
      if (!ratingsData) return 'NR';

      const results = ratingsData?.results ?? [];

      // helper: get the rating string for a country if present and not empty
      const findRatingForCountry = (countryCode: string) => {
        const countryObj = results.find(
          (r: any) => r.iso_3166_1 === countryCode,
        );
        if (!countryObj || !countryObj.rating) return null;
        const rating = String(countryObj.rating).trim();
        return rating === '' ? null : rating;
      };

      // normalizer for TV rating strings
      const normalizeTvRating = (rating: string | null | undefined): string => {
        if (!rating) return 'NR';
        const r = String(rating).toUpperCase();

        if (r.includes('MA') || r === 'TV-MA') return 'TV-MA';
        if (r.includes('14') || r === 'TV-14') return 'TV-14';
        if (r.includes('PG') || r === 'TV-PG') return 'TV-PG';
        if (r.includes('G') || r === 'TV-G') return 'TV-G';
        if (r.includes('Y7') || r === 'TV-Y7') return 'TV-Y7';
        if (r === 'Y' || r === 'TV-Y') return 'TV-Y';

        // return the original rating if it did not match known forms
        return rating;
      };

      // 1) try US
      const us = findRatingForCountry('US');
      if (us) return normalizeTvRating(us);

      // 2) fallback to other common countries in order
      for (const country of fallbackCountries) {
        const r = findRatingForCountry(country);
        if (r) return normalizeTvRating(r);
      }

      // 3) final fallback: first available rating in results
      for (const obj of results) {
        const r = obj?.rating;
        if (r && String(r).trim() !== '') return normalizeTvRating(r);
      }

      return 'NR';
    };

    const contentRating = getContentRating(contentRatingsRaw);

    // normalized info object that frontend can consume directly
    const info = {
      id: infoRaw?.id,
      title: infoRaw?.title ?? infoRaw?.name ?? 'Untitled',
      original_title: infoRaw?.original_title ?? infoRaw?.original_name ?? null,
      overview: infoRaw?.overview ?? '',
      release_date: infoRaw?.release_date ?? infoRaw?.first_air_date ?? '',
      runtime: infoRaw?.last_episode_to_air?.runtime,
      budget: infoRaw?.budget ?? 0,
      revenue: infoRaw?.revenue ?? 0,
      vote_average: infoRaw?.vote_average ?? 0,
      vote_count: infoRaw?.vote_count ?? 0,
      genres: infoRaw?.genres ?? [],
      production_companies: infoRaw?.production_companies ?? [],
      production_countries,
      spoken_languages: infoRaw?.spoken_languages ?? [],
      status:
        infoRaw?.status ??
        (infoRaw?.in_production ? 'In Production' : 'Released'),
      tagline: infoRaw?.tagline ?? null,
      homepage: infoRaw?.homepage ?? null,
      poster_path: infoRaw?.poster_path ?? null,
      backdrop_path: infoRaw?.backdrop_path ?? null,
      adult: infoRaw?.adult ?? false,
      created_by: infoRaw?.created_by ?? null,
      content_type: detectedType, // explicitly tell frontend the type
      director,
      content_rating: contentRating, // standardized content rating
      // TV-specific fields
      number_of_seasons: infoRaw?.number_of_seasons ?? null,
      number_of_episodes: infoRaw?.number_of_episodes ?? null,
      episode_run_time: infoRaw?.episode_run_time ?? [],
      first_air_date: infoRaw?.first_air_date ?? null,
      last_air_date: infoRaw?.last_air_date ?? null,
      networks: infoRaw?.networks ?? [],
      seasons: infoRaw?.seasons ?? [],
    };

    const credits = {
      cast: (creditsRaw?.cast ?? []).sort(
        (a: any, b: any) => (a.order ?? 999) - (b.order ?? 999),
      ),
      crew: creditsRaw?.crew ?? [],
    };

    const reviews = reviewsRaw?.results ?? reviewsRaw ?? [];
    const similar = similarRaw?.results ?? similarRaw ?? [];
    const providers = providersRaw ?? {};

    const payload = {
      info,
      credits,
      trailer,
      providers,
      reviews,
      similar,
      raw: {
        info: infoRaw,
        credits: creditsRaw,
        videos: videosRaw,
        providers: providersRaw,
        reviews: reviewsRaw,
        similar: similarRaw,
        content_ratings: contentRatingsRaw,
      },
    };

    // cache for 5 minutes
    // await this.redisService.set(cacheKey, JSON.stringify(payload), 300);

    return payload;
  }

  async fetchSeasonsWithEpisodes(
    id: number,
    options: { includeEpisodeDetails?: boolean } = {
      includeEpisodeDetails: true,
    },
  ) {
    const infoRaw = await this.fetchInfo(id, 'tv');
    if (!infoRaw) return null;

    const seasons = infoRaw.seasons ?? [];

    if (!options.includeEpisodeDetails) {
      return seasons.map((s: any) => ({
        season_number: s.season_number,
        name: s.name,
        overview: s.overview,
        air_date: s.air_date,
        episode_count: s.episode_count,
        poster_path: s.poster_path,
      }));
    }

    // fetch each season detail (episodes) in parallel but resiliently
    const promises = seasons.map((s: any) =>
      this.tmdb(`tv/${id}/season/${s.season_number}?language=en-US`),
    );
    const results = await Promise.allSettled(promises);

    const seasonDetails = results.map((r, idx) => {
      const basic = seasons[idx] ?? {};
      if (r.status === 'fulfilled' && r.value) {
        const s: any = r.value;
        return {
          season_number: s.season_number,
          name: s.name,
          overview: s.overview,
          air_date: s.air_date,
          poster_path: s.poster_path,
          episode_count: s.episodes?.length ?? basic.episode_count ?? 0,
          episodes: (s.episodes ?? []).map((e: any) => ({
            episode_number: e.episode_number,
            name: e.name,
            overview: e.overview,
            air_date: e.air_date,
            runtime: e.runtime ?? null,
            still_path: e.still_path ?? null,
            vote_average: e.vote_average ?? null,
          })),
        };
      }

      // fallback: return minimal season info if season detail failed
      return {
        season_number: basic.season_number,
        name: basic.name,
        overview: basic.overview,
        air_date: basic.air_date,
        poster_path: basic.poster_path,
        episode_count: basic.episode_count ?? 0,
        episodes: [],
      };
    });

    return seasonDetails;
  }

  // Load TV genres
  async loadGenres() {
    if (!this.token) {
      this.logger.warn('TMDB token not set; skipping loadGenres');
      return;
    }

    try {
      const data = await this.tmdb('/genre/tv/list');
      const genres = data?.genres ?? [];
      for (const g of genres) {
        this.genreMap[g.id] = g.name;
      }
      this.logger.log(`Loaded TV genres: ${Object.keys(this.genreMap).length}`);
    } catch (err) {
      this.logger.error('Failed to load TV genres', err as any);
    }
  }

  async onModuleInit() {
    await this.loadGenres();
  }

  // Utility to get date X days ago
  private getRecentDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  // Content filtering
  private readonly BANNED_WORDS = [
    '에로',
    '성인',
    '야한',
    '포르노',
    '섹스',
    '성적',
    '노출',
    '관음',
    '야설',
    'porn',
    'sex',
    'xxx',
    'erotic',
    'adult',
    'nude',
    'av',
  ];

  private readonly BANNED_GENRE_IDS = new Set<number>([
    2916, 3568, 2972, 10364,
  ]);

  private readonly MIN_VOTE_COUNT = 20;

  private isAdultishItem(m: any): boolean {
    const title = (m.title ?? m.name ?? '').toString().toLowerCase();
    const overview = (m.overview ?? '').toString().toLowerCase();

    // Keyword match
    for (const bad of this.BANNED_WORDS) {
      if (title.includes(bad) || overview.includes(bad)) return true;
    }

    // Genre match
    if (
      Array.isArray(m.genre_ids) &&
      m.genre_ids.some((g: number) => this.BANNED_GENRE_IDS.has(g))
    ) {
      return true;
    }

    // Adult flag
    if (m.adult === true) return true;

    // Low vote count
    if (
      typeof m.vote_count === 'number' &&
      m.vote_count < this.MIN_VOTE_COUNT
    ) {
      return true;
    }

    return false;
  }

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

  // Background recommendation population
  private async populateRecommendationsBackground(items: TmdbTv[]) {
    setTimeout(async () => {
      const tasks = items.map((item) => async () => {
        try {
          const recs = await this.getSmartRecommendationsTv(item.id, 3);
          item.recommendations = recs;
          return item;
        } catch (err) {
          this.logger.error(
            `Failed to populate recommendations for ${item.id}`,
            err,
          );
          return item;
        }
      });

      await this.withConcurrencyLimit(tasks, 3);
    }, 100);
  }

  // Convert TMDB result to TmdbTv
  private mapToTmdbTv(m: any, includeRecommendations = false): TmdbTv {
    return {
      id: m.id,
      title: m.title ?? m.name ?? 'Untitled',
      overview: m.overview ?? '',
      poster_path: m.poster_path ?? null,
      backdrop_path: m.backdrop_path ?? null,
      release_date: m.first_air_date ?? null,
      vote_average: m.vote_average,
      vote_count: m.vote_count,
      popularity: m.popularity,
      origin_country: m.origin_country ?? [],
      genres: m.genre_ids
        ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
        : [],
      type: 'tv',
      recommendations: includeRecommendations ? [] : undefined,
      network: m.networks?.[0]?.name,
      created_by: m.created_by?.[0]?.name,
      genre_ids: m.genre_ids,
      number_of_episodes: m.number_of_episodes,
      number_of_seasons: m.number_of_seasons,
      first_air_date: m.first_air_date,
      last_air_date: m.last_air_date,
      status: m.status,
      runtime: m.runtime,
    };
  }

  async getFeatured(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    // const cacheKey = `featured`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         return (JSON.parse(cached) as TmdbTv[]).slice(0, limit);
    //     } catch { }
    // }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty featured');
      return [];
    }

    try {
      // Pull from both TV + Movies with recent filters
      const [tv] = await Promise.all([
        this.tmdb(
          `/discover/tv?sort_by=popularity.desc&include_adult=false&page=1
                  &first_air_date.gte=${this.getRecentDate(365)} 
                  &without_keywords=13090,190720`,
        ),
      ]);

      const results = [...(tv?.results ?? [])];

      const tvContent: TmdbTv[] = results.map((m: any) => ({
        id: m.id,
        title: m.title ?? m.name ?? 'Untitled',
        overview: m.overview ?? '',
        poster_path: m.poster_path ?? null,
        backdrop_path: m.backdrop_path ?? null,
        release_date: m.release_date ?? m.first_air_date ?? null,
        vote_average: m.vote_average,
        vote_count: m.vote_count,
        popularity: m.popularity,
        origin_country:
          m.origin_country ??
          m.production_countries?.map((c: any) => c.iso_3166_1) ??
          [],
        genres: m.genre_ids
          ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
          : [],
        type: m.media_type ?? (m.title ? 'movie' : 'tv'),
      }));

      const shuffled = shuffleArray(tvContent);
      const sliced = shuffled.slice(0, Math.max(0, limit));

      // await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
      return sliced;
    } catch (err) {
      this.logger.error('Failed to fetch featured', err as any);
      return [];
    }
  }

  // Trending TV shows
  async getTrending(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    // const cacheKey = `trending-${limit}`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         return (JSON.parse(cached) as TmdbTv[]).slice(0, limit);
    //     } catch { }
    // }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trending');
      return [];
    }

    try {
      // Get trending but only recent ones
      const data = await this.tmdb(`/trending/tv/day?include_adult=false`);

      const results = (data?.results ?? []).filter((m: any) => {
        const date = new Date(m.release_date ?? m.first_air_date ?? '');
        return date >= new Date(this.getRecentDate(365)); // last 12 months
      });

      const basicItems: TmdbTv[] = results.slice(0, limit).map((m: any) => ({
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

      const shuffled = shuffleArray(basicItems);
      // await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);

      // populate recommendations in background
      this.populateRecommendationsBackground(basicItems);

      return shuffled.slice(0, limit);
    } catch (err) {
      this.logger.error('Failed to fetch trending', err as any);
      return [];
    }
  }

  // Airing today
  async airingToday(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty airing today');
      return [];
    }

    try {
      const data = await this.tmdb('/tv/airing_today?language=en-US&page=1');
      const results = data?.results ?? [];
      const filtered = this.filterAdultishContent(results);
      const items: TmdbTv[] = filtered
        .slice(0, limit)
        .map((m) => this.mapToTmdbTv(m, true));
      const shuffled = shuffleArray(items);

      this.populateRecommendationsBackground(shuffled);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch airing today', err as any);
      return [];
    }
  }

  // Airing this week (on the air)
  async airingThisWeek(limit = 30): Promise<TmdbTv[]> {
    if (!this.token) {
      this.logger.warn(
        'TMDB_API_KEY not set; returning empty airing this week',
      );
      return [];
    }

    try {
      const data = await this.tmdb('/tv/on_the_air?language=en-US&page=1');
      const results = data?.results ?? [];
      const filtered = this.filterAdultishContent(results);
      const items: TmdbTv[] = filtered
        .slice(0, limit)
        .map((m) => this.mapToTmdbTv(m, true));
      const shuffled = shuffleArray(items);

      this.populateRecommendationsBackground(shuffled);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch airing this week', err as any);
      return [];
    }
  }

  // Top rated TV shows
  async getFavorites(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    // const cacheKey = `favorites`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         const parsed = JSON.parse(cached) as TmdbTv[];
    //         return parsed.slice(0, limit);
    //     } catch { }
    // }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
      return [];
    }

    try {
      const data = await this.tmdb('/trending/tv/day');
      const results = data?.results ?? [];
      const filtered = results.filter((item: any) => item.media_type === 'tv');

      // apply adult-ish filter
      const clean = this.filterAdultishContent(filtered);

      const all: TmdbTv[] = clean.map((m: any) => ({
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
      // await this.redisService.set(cacheKey, JSON.stringify(sliced), ttlSec);
      return sliced;
    } catch (err) {
      this.logger.error('Failed to fetch favorites', err as any);
      return [];
    }
  }

  // TV by revenue (discover endpoint)
  async getRevenue(limit = 30): Promise<TmdbTv[]> {
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty revenue');
      return [];
    }

    try {
      const data = await this.tmdb(
        '/discover/tv?language=en-US&sort_by=revenue.desc&page=1',
      );
      const results = data?.results ?? [];
      const filtered = this.filterAdultishContent(results);
      const items: TmdbTv[] = filtered
        .slice(0, limit)
        .map((m) => this.mapToTmdbTv(m, true));
      const shuffled = shuffleArray(items);

      this.populateRecommendationsBackground(shuffled);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch revenue TV', err as any);
      return [];
    }
  }

  // TV by genres
  async tvByGenres(
    ids: string,
    useAnd: boolean = false,
    limit = 30,
  ): Promise<TmdbTv[]> {
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty genre results');
      return [];
    }

    try {
      const genresParam = useAnd ? ids : ids.replace(/,/g, '|');

      // Auto-calculate "5 years ago"
      const today = new Date();
      const fiveYearsAgo = new Date(
        today.getFullYear() - 5,
        0,
        1, // always start from Jan 1 of that year
      );
      const gteDate = fiveYearsAgo.toISOString().split('T')[0]; // YYYY-MM-DD

      // Single inline query string
      const url =
        `/discover/tv?language=en-US&page=1` +
        `&with_genres=${genresParam}` +
        `&include_adult=false` +
        `&include_null_first_air_dates=false` +
        `&sort_by=first_air_date.desc` +
        `&first_air_date.gte=${gteDate}` +
        `&vote_count.gte=50`;

      const data = await this.tmdb(url);
      const results = data?.results ?? [];

      const filtered = this.filterAdultishContent(results);
      const items: TmdbTv[] = filtered
        .slice(0, limit)
        .map((m) => this.mapToTmdbTv(m, true));

      const shuffled = shuffleArray(items);

      this.populateRecommendationsBackground(shuffled);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch TV by genres', err as any);
      return [];
    }
  }

  private scoreCandidates(
    candidates: any[],
    baseLang?: string,
    baseGenreIds: number[] = [],
    baseCountries: string[] = [],
  ) {
    interface Scored {
      score: number;
    }
    const scored: Scored[] = candidates.map((candidate) => {
      let score = 0;
      const priorityBonus =
        [0, 100, 80, 70, 60, 40, 20][candidate.priority] || 0;
      score += priorityBonus;

      if (baseLang && candidate.original_language === baseLang) score += 50;

      if (baseCountries.length > 0) {
        const candidateCountries =
          candidate.origin_country ||
          candidate.production_countries?.map((c: any) => c.iso_3166_1) ||
          [];

        const hasCountryMatch = candidateCountries.some((c: string) =>
          baseCountries.includes(c),
        );
        if (hasCountryMatch) score += 40;
      }

      const candidateGenres = candidate.genre_ids || [];
      if (baseGenreIds.length > 0 && candidateGenres.length > 0) {
        const overlap = baseGenreIds.filter((g) =>
          candidateGenres.includes(g),
        ).length;
        score += overlap * 15;
      }

      score += Math.min(15, (candidate.popularity || 0) / 20);
      score += Math.min(10, (candidate.vote_average || 0) * 1.2);

      // Recency bonus
      const dateStr = candidate.release_date || candidate.first_air_date;
      if (dateStr) {
        const releaseDate = new Date(dateStr);
        const yearsDiff =
          (Date.now() - releaseDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
        if (yearsDiff < 3) score += Math.max(0, 10 - yearsDiff * 3);
      }

      return { ...candidate, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  private async fetchTrailersForCandidates(
    type: 'movie' | 'tv',
    candidates: any[],
  ) {
    const tasks = candidates.map((cand) => async (): Promise<any> => {
      try {
        const videosData = await this.tmdb(
          `${this.baseUrl}/${type}/${cand.id}/videos?language=en-US`,
        );
        const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
        let trailer: any = null;
        for (const t of trailerTypes) {
          trailer = (videosData?.results ?? []).find(
            (v: any) => v.type === t && v.site === 'YouTube',
          );
          if (trailer) break;
        }
        return {
          ...cand,
          trailer_key: trailer?.key || null,
          hasTrailer: !!trailer,
        };
      } catch {
        return { ...cand, trailer_key: null, hasTrailer: false };
      }
    });

    // withConcurrencyLimit expects array of functions returning promises
    return this.withConcurrencyLimit(tasks, 6);
  }

  // Smart recommendations for TV shows
  async getSmartRecommendationsTv(
    id: number,
    limit = 10,
    minRequired = 3,
  ): Promise<TmdbTv[]> {
    const cacheKey = `smart-rec-tv-v2-${id}-${limit}`;

    try {
      const baseItem = await this.tmdb(
        `${this.baseUrl}/tv/${id}?language=en-US`,
      );
      if (!baseItem) return [];

      const baseLang = baseItem.original_language;
      const baseGenreIds: number[] = (baseItem.genres ?? []).map(
        (g: any) => g.id,
      );
      const baseCountries: string[] = baseItem.origin_country ?? [];

      const allCandidates: any[] = [];
      const seenIds = new Set<number>([id]);

      // recommendations & similar in parallel
      const [recData, simData] = await Promise.allSettled([
        this.tmdb(
          `${this.baseUrl}/tv/${id}/recommendations?language=en-US&page=1`,
        ),
        this.tmdb(`${this.baseUrl}/tv/${id}/similar?language=en-US&page=1`),
      ]);

      if (recData.status === 'fulfilled' && recData.value?.results) {
        for (const item of recData.value.results) {
          if (!seenIds.has(item.id)) {
            allCandidates.push({
              ...item,
              source: 'recommendations',
              priority: 2,
            });
            seenIds.add(item.id);
          }
        }
      }

      if (simData.status === 'fulfilled' && simData.value?.results) {
        for (const item of simData.value.results) {
          if (!seenIds.has(item.id)) {
            allCandidates.push({ ...item, source: 'similar', priority: 3 });
            seenIds.add(item.id);
          }
        }
      }

      // Genre discovery (tv)
      if (allCandidates.length < limit * 2 && baseGenreIds.length > 0) {
        try {
          const genreQuery = baseGenreIds.slice(0, 2).join(',');
          const discoverUrl = `${this.baseUrl}/discover/tv?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

          if (baseLang && baseCountries.length > 0) {
            const langCountryUrl = `${discoverUrl}&with_original_language=${baseLang}&with_origin_country=${baseCountries[0]}`;
            const langCountryData = await this.tmdb(langCountryUrl);
            if (langCountryData?.results) {
              for (const item of langCountryData.results.slice(0, 10)) {
                if (!seenIds.has(item.id)) {
                  allCandidates.push({
                    ...item,
                    source: 'genre-lang-country',
                    priority: 4,
                  });
                  seenIds.add(item.id);
                }
              }
            }
          }

          if (allCandidates.length < limit * 1.5) {
            const genreData = await this.tmdb(discoverUrl);
            if (genreData?.results) {
              for (const item of genreData.results.slice(0, 15)) {
                if (!seenIds.has(item.id)) {
                  allCandidates.push({ ...item, source: 'genre', priority: 5 });
                  seenIds.add(item.id);
                }
              }
            }
          }
        } catch (err) {
          this.logger.warn(`Genre discovery failed for tv/${id}`, err);
        }
      }

      // Popular fallback (tv)
      if (allCandidates.length < minRequired * 2) {
        try {
          const popularData = await this.tmdb(
            `${this.baseUrl}/tv/popular?language=en-US&page=1`,
          );
          if (popularData?.results) {
            for (const item of popularData.results.slice(0, 20)) {
              if (!seenIds.has(item.id)) {
                allCandidates.push({ ...item, source: 'popular', priority: 6 });
                seenIds.add(item.id);
              }
            }
          }
        } catch (err) {
          this.logger.warn(`Popular fallback failed for tv/${id}`, err);
        }
      }

      // Scoring (shared)
      const scored = this.scoreCandidates(
        allCandidates,
        baseLang,
        baseGenreIds,
        baseCountries,
      );

      // Trailer fetching
      const topCandidates = scored.slice(
        0,
        Math.max(limit * 3, minRequired * 5),
      );
      const withTrailerInfo = await this.fetchTrailersForCandidates(
        'tv',
        topCandidates,
      );

      const withTrailers = withTrailerInfo.filter((i) => i.hasTrailer);
      const withoutTrailers = withTrailerInfo.filter((i) => !i.hasTrailer);
      let finalCandidates = [...withTrailers, ...withoutTrailers];

      if (finalCandidates.length < minRequired) {
        this.logger.warn(
          `Only found ${finalCandidates.length} tv recommendations for ${id}`,
        );
      }

      const final: TmdbTv[] = finalCandidates
        .slice(0, limit)
        .map((item: any) => ({
          id: item.id,
          title: item.title || item.name || 'Untitled',
          overview: item.overview || '',
          poster_path: item.poster_path || null,
          backdrop_path: item.backdrop_path || null,
          release_date: item.first_air_date || item.release_date || null,
          vote_average: item.vote_average,
          vote_count: item.vote_count,
          popularity: item.popularity,
          origin_country: item.origin_country || [],
          genres: (item.genre_ids || []).map(
            (gid: number) => this.genreMap[gid] || 'Unknown',
          ),
          trailer_key: item.trailer_key,
          type: 'tv',
        }));

      return final;
    } catch (err) {
      this.logger.error(`getSmartRecommendationsTv failed for tv/${id}`, err);
      return [];
    }
  }

  // OPTIMIZED: Korea trending with background processing + filtering
  async getKoreaTrending(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.BASIC_DATA;
    // const cacheKey = `koreaTrending-${limit}`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         const parsed = JSON.parse(cached) as TmdbTv[];
    //         return parsed.slice(0, limit);
    //     } catch { }
    // }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
      return [];
    }

    try {
      // Fetch Korean TV + Korean Movies in parallel with TMDB-side filters
      const [tvData] = await Promise.all([
        this.tmdb(
          `${this.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`,
        ),
      ]);

      let results = [...(tvData?.results ?? [])];

      // Post-fetch aggressive filter
      results = this.filterAdultishContent(results);

      // Process basic info first and defer recommendations
      const items: TmdbTv[] = results.slice(0, limit).map((m) => {
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
          genres:
            m.genre_ids?.map((id: number) => this.genreMap[id] || 'Unknown') ??
            [],
          type,
          recommendations: [], // Populate later in background
        };
      });

      const shuffled = shuffleArray(items);

      // Cache and start background recommendation population
      // await this.redisService.set(cacheKey, JSON.stringify(shuffled), ttlSec);
      this.populateRecommendationsBackground(shuffled);

      return shuffled.slice(0, Math.max(0, limit));
    } catch (err) {
      this.logger.error('Failed to fetch koreaTrending', err as any);
      return [];
    }
  }

  async getTrendingReviews(limit = 40): Promise<
    {
      quote: string;
      name: string;
      title: string;
      avatar: string;
      rating?: number | null;
    }[]
  > {
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
        const trendingData = await this.tmdb(
          `${this.baseUrl}/trending/tv/week?language=en-US&page=${p}`,
        );
        const results = trendingData?.results ?? [];

        for (const item of results) {
          if (reviews.length >= limit) break;

          const reviewPromises: Promise<any>[] = [];
          for (let rp = 1; rp <= reviewPages; rp++) {
            const reviewUrl = `${this.baseUrl}/tv/${item.id}/reviews?language=en-US&page=${rp}`;
            reviewPromises.push(this.tmdb(reviewUrl));
          }

          const reviewPagesData = await Promise.all(reviewPromises);

          for (const pageData of reviewPagesData) {
            const reviewsPage = pageData?.results ?? [];
            for (const review of reviewsPage) {
              const avatarPath = review?.author_details?.avatar_path;
              if (avatarPath) {
                let avatar = avatarPath.trim();
                if (avatar.startsWith('/http')) avatar = avatar.substring(1);
                else if (avatar.startsWith('/'))
                  avatar = `https://image.tmdb.org/t/p/w185${avatar}`;

                reviews.push({
                  quote: review.content.slice(0, 200) + '...',
                  name: review.author ?? 'Anonymous',
                  title: item.title ?? item.name ?? 'Untitled',
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

  async getUpcomingTrailers(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.TRAILERS;
    const cacheKey = `trailers-upcoming-${limit}`;

    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         return JSON.parse(cached) as TmdbTv[];
    //     } catch { }
    // }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      const items: TmdbTv[] = [];
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const maxPages = 20;

      const fetchTrailers = async (mediaType: 'tv') => {
        for (let page = 1; page <= maxPages; page++) {
          const url = `${this.baseUrl}/discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${page}`;

          const data = await this.tmdb(url);
          const results = data?.results ?? [];

          // Process with concurrency control
          const trailerTasks = results.map((m: any) => async () => {
            const rd = m.release_date ?? m.first_air_date;
            if (!rd || new Date(rd) < today) return null;

            try {
              // Fetch videos and details in parallel
              const [videosData, details] = await Promise.all([
                this.tmdb(
                  `${this.baseUrl}/tv/${m.id}/videos?language=en-US`,
                ),
                this.tmdb(
                  `${this.baseUrl}/tv/${m.id}?language=en-US`,
                ),
              ]);

              const trailer = (videosData?.results ?? []).find(
                (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
              );
              if (!trailer) return null;

              return {
                id: m.id,
                title: m.title ?? m.name ?? 'Untitled',
                overview: m.overview ?? '',
                poster_path: m.poster_path ?? null,
                backdrop_path: m.backdrop_path ?? null,
                release_date: rd,
                vote_average: m.vote_average,
                trailer_key: trailer.key,
                type: mediaType,
                recommendations: [],
                number_of_episodes:
                  mediaType === 'tv'
                    ? (details.number_of_episodes ?? null)
                    : null,
                genres: details.genres
                  ? details.genres.map((g: any) => g.name)
                  : [],
              } as TmdbTv;
            } catch {
              return null;
            }
          });

          const pageResults = (
            await this.withConcurrencyLimit(trailerTasks)
          ).filter((item): item is TmdbTv => item !== null);

          items.push(...pageResults);

          if (items.length >= limit) break;
        }
      };

      // Fetch both movie and TV concurrently
      await Promise.all([fetchTrailers('tv')]);

      // Sort by release date and limit
      const sorted = items
        .sort(
          (a, b) =>
            (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
            (b.release_date ? new Date(b.release_date).getTime() : Infinity),
        )
        .slice(0, limit);

      // Populate recommendations in background (don't await)
      setTimeout(async () => {
        const tasks = sorted.map((item) => async () => {
          try {
            item.recommendations = await this.getSmartRecommendationsTv(
              item.id,
              3,
            );
            return item;
          } catch (err) {
            this.logger.error(
              `Failed to populate recommendations for ${item.id}`,
              err,
            );
            return item;
          }
        });

        const updatedItems = await this.withConcurrencyLimit(tasks, 3);
        // await this.redisService.set(cacheKey, JSON.stringify(updatedItems), ttlSec);
      }, 100);

      // await this.redisService.set(cacheKey, JSON.stringify(sorted), ttlSec);
      return sorted;
    } catch (err) {
      this.logger.error('Failed to fetch upcoming trailers', err as any);
      return [];
    }
  }

  // Get TV show images
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

  // Get trailer for TV show
  async getTrailers(limit = 30): Promise<TmdbTv[]> {
    const ttlSec = this.CACHE_TTL.TRAILERS;
    // const cacheKey = `trailers-enhanced-${limit}`;

    // // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         const parsed = JSON.parse(cached) as TmdbTv[];
    //         return parsed;
    //     } catch { }
    // }

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      // Multi-source approach to get diverse content with trailers
      const sources = [
        // Korean content (original focus)
        `${this.baseUrl}/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1`,
        // Popular TV with high ratings (likely to have trailers)
        `${this.baseUrl}/tv/popular?language=en-US&page=1`,
        // Top rated TV (quality content)
        `${this.baseUrl}/tv/top_rated?language=en-US&page=1`,
        // Recent releases (likely to have trailers)
        `${this.baseUrl}/discover/tv?sort_by=release_date.desc&first_air_date.gte=${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&page=1`,
      ];

      // Fetch from multiple sources
      const allResults: any[] = [];
      for (const url of sources) {
        try {
          const data = await this.tmdb(url);
          if (data?.results?.length) {
            allResults.push(...data.results);
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch from source: ${url}`, err);
        }
      }

      // Deduplicate by ID while preserving order (Korean content first)
      const uniqueItems: any[] = [];
      const seenIds = new Set<number>();
      for (const item of allResults) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueItems.push(item);
        }
      }

      // Process with enhanced trailer fetching
      const trailerTasks = uniqueItems
        .slice(0, limit * 2)
        .map((m: any) => async (): Promise<TmdbTv | null> => {
          try {
            const type = 'tv'; // Focus on TV series

            // Fetch videos, details, and additional info in parallel
            const [videosData, details] = await Promise.all([
              this.tmdb(
                `${this.baseUrl}/${type}/${m.id}/videos?language=en-US`,
              ),
              this.tmdb(`${this.baseUrl}/${type}/${m.id}?language=en-US`).catch(
                () => null,
              ),
            ]);

            // Enhanced trailer finding - look for multiple types
            const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
            let trailer: any = null;

            for (const trailerType of trailerTypes) {
              trailer = (videosData?.results ?? []).find(
                (v: any) => v.type === trailerType && v.site === 'YouTube',
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
              genres: details?.genres
                ? details.genres.map((g: any) => g.name)
                : [],
              origin_country: details?.origin_country ?? m.origin_country ?? [],
              type: type,
              genre_ids: details?.genres
                ? details.genres.map((g: any) => g.id)
                : (m.genre_ids ?? []),
            };
          } catch (err) {
            this.logger.warn(`Failed to process trailer for ${m.id}`, err);
            return null;
          }
        });

      const withTrailers = (await this.withConcurrencyLimit(trailerTasks, 5))
        .filter((item): item is TmdbTv => item !== null)
        .slice(0, limit);

      // Background population of recommendations
      this.populateRecommendationsBackground(withTrailers);

      // Cache the results
      // await this.redisService.set(cacheKey, JSON.stringify(withTrailers), ttlSec);
      const shuffled = shuffleArray(withTrailers);
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch trailers', err as any);
      return [];
    }
  }

  async getTrailersForItems(
    items: { id: number }[],
  ): Promise<Record<string, string | null>> {
    // const cacheKey = `batch-trailers-${items.map(i => `${i.type}-${i.id}`).join(',')}`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //     try {
    //         return JSON.parse(cached);
    //     } catch { }
    // }

    const tasks = items.map((item) => async () => {
      try {
        const videosData = await this.tmdb(
          `${this.baseUrl}/tv/${item.id}/videos?language=en-US`,
        );
        const trailer = (videosData?.results ?? []).find(
          (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
        );
        return [`TV-${item.id}`, trailer?.key ?? null];
      } catch {
        return [`TV-${item.id}`, null];
      }
    });

    const results = await this.withConcurrencyLimit(tasks);
    const trailerMap = Object.fromEntries(results);

    // await this.redisService.set(cacheKey, JSON.stringify(trailerMap), this.CACHE_TTL.TRAILERS);
    return trailerMap;
  }
}
