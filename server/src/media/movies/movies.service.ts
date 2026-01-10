import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// import { RedisService } from 'src/redis/redis.service';

type ContentType = 'movie';

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  genres?: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  origin_country?: string[];
  recommendations?: TmdbMovie[];
  type?: ContentType;
  trailer_key?: string | null;
  runtime?: number;
  genre_ids?: number[]; // for internal use
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
export class MoviesService implements OnModuleInit {
  private readonly logger = new Logger(MoviesService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private genreMap: Record<number, string> = {};
  private readonly maxConcurrentRequests = 5; // TMDB rate limit consideration
  private readonly MIN_REQUIRED_ITEMS = 25;

  // Cache TTL constants
  private readonly CACHE_TTL = {
    BASIC_DATA: 60 * 60 * 24,
    RECOMMENDATIONS: 60 * 60 * 24,
    TRAILERS: 60 * 60 * 24,
    GENRES: 60 * 60 * 24,
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

  // Generic helper: returns response.data (not only results)
  private async tmdb(endpoint: string) {
    let normalizedEndpoint: string;

    // If it's a full URL, use it as-is
    if (endpoint.startsWith('http')) {
      normalizedEndpoint = endpoint;
    } else {
      // Remove leading slash from endpoint if present
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

      // Remove trailing slash from baseUrl if present
      const cleanBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;

      // Combine with single slash
      normalizedEndpoint = `${cleanBase}/${cleanEndpoint}`;
    }

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

  private async fetchInfo(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}?language=en-US`);
  }

  private async fetchCredits(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}/credits?language=en-US`);
  }

  private async fetchVideos(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}/videos?language=en-US`);
  }

  private async fetchProviders(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}/watch/providers`);
  }

  private async fetchReviews(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}/reviews?language=en-US&page=1`);
  }

  private async fetchSimilar(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}/similar?language=en-US&page=1`);
  }

  private async fetchContentRatings(id: number, type: ContentType = 'movie') {
    return await this.tmdb(`${type}/${id}/release_dates`);
  }

  // Public: prepared, normalized details payload
  async movieDetails(id: number, preferredType?: ContentType) {
    // allow frontend to force type via query param if it already knows it
    // const cacheKey = `movie/details/${id}/${preferredType ?? 'auto'}`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //   try {
    //     return JSON.parse(cached);
    //   } catch (err) {
    //     this.logger.warn('Failed to parse cached movie details, will refetch', err);
    //   }
    // }

    const detectedType: ContentType = 'movie';

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

    // normalise runtime
    const runtime =
      infoRaw?.runtime ??
      // tv uses episode_run_time as array of minutes
      (Array.isArray(infoRaw?.episode_run_time)
        ? (infoRaw.episode_run_time[0] ?? 0)
        : (infoRaw?.episode_run_time ?? 0)) ??
      0;

    // normalise production countries for tv and movie
    const production_countries =
      infoRaw?.production_countries ??
      (infoRaw?.origin_country
        ? (infoRaw.origin_country as string[]).map((c) => ({ iso_3166_1: c }))
        : []);

    // director or creator
    const director =
      (creditsRaw?.crew ?? []).find((c: any) => c.job === 'Director')?.name ??
      (infoRaw?.created_by && infoRaw.created_by[0]?.name) ??
      undefined;
    // Movie-only: try US first, then fallback to other common countries, then any available cert
    const getContentRating = (
      ratingsData: any,
      fallbackCountries: string[] = ['GB', 'CA', 'AU', 'FR', 'DE', 'IN', 'JP'],
    ): string => {
      if (!ratingsData) return 'NR';

      const results = ratingsData?.results ?? [];

      // helper: return the first non-empty certification for a country
      const findCertForCountry = (countryCode: string) => {
        const countryObj = results.find(
          (r: any) => r.iso_3166_1 === countryCode,
        );
        if (!countryObj || !Array.isArray(countryObj.release_dates))
          return null;
        const entry = countryObj.release_dates.find(
          (d: any) => d.certification && String(d.certification).trim() !== '',
        );
        return entry?.certification ?? null;
      };

      // 1) Try US only
      const usCert = findCertForCountry('US');
      if (usCert) return usCert;

      // 2) Fallback to other common countries (in provided order)
      for (const country of fallbackCountries) {
        const cert = findCertForCountry(country);
        if (cert) return cert;
      }

      // 3) Final fallback: first available certification across all countries
      for (const countryObj of results) {
        if (!Array.isArray(countryObj.release_dates)) continue;
        const entry = countryObj.release_dates.find(
          (d: any) => d.certification && String(d.certification).trim() !== '',
        );
        if (entry?.certification) return entry.certification;
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
      runtime,
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
      created_by: infoRaw?.created_by ?? null,
      content_type: detectedType, // explicitly tell frontend the type
      director,
      content_rating: contentRating,
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
      },
    };

    // cache for 5 minutes
    // await this.redisService.set(cacheKey, JSON.stringify(payload), 300);

    return payload;
  }

  // === Genres loader (in-memory map) ===
  async loadGenres() {
    if (!this.token) {
      this.logger.warn('TMDB token not set; skipping loadGenres');
      return;
    }

    try {
      const endpoints = ['/genre/movie/list'];
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

  async getFeatured(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty featured');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;

      const maxPages = page !== undefined ? 20 : 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const movies = await this.tmdb(
          `discover/movie?sort_by=popularity.desc&include_adult=false&page=${currentPage}&primary_release_date.gte=${this.getRecentDate(365)}&without_keywords=13090,190720`,
        );

        const results = movies?.results ?? [];
        allResults.push(...results);
        currentPage++;

        if (results.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const basicItems: TmdbMovie[] = uniqueItems.map((m: any) => ({
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

      const items = page !== undefined ? basicItems : shuffleArray(basicItems);

      if (!page) {
        return items.slice(0, minRequired);
      }

      const total = items.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = items.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch featured', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  async getTrending(limit = 30, page?: number): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trending');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;
      const maxPages = page !== undefined ? 20 : 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const data = await this.tmdb(`trending/movie/day?include_adult=false&page=${currentPage}`);

        const results = (data?.results ?? []).filter((m: any) => {
          const date = new Date(m.release_date ?? m.first_air_date ?? '');
          return date >= new Date(this.getRecentDate(365));
        });

        allResults.push(...results);
        currentPage++;

        if (results.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const basicItems: TmdbMovie[] = uniqueItems.map((m: any) => ({
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

      if (!page) {
        const homepageItems = basicItems.slice(0, minRequired);
        this.populateRecommendationsBackground(homepageItems);
        return homepageItems;
      }

      const total = basicItems.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = basicItems.slice(startIndex, endIndex);

      this.populateRecommendationsBackground(paginatedData);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch trending', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  private getRecentDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  private async populateRecommendationsBackground(items: TmdbMovie[]) {
    setTimeout(async () => {
      const tasks = items.map((item) => async () => {
        try {
          const recs = await this.getSmartRecommendationsMovie(item.id, 3);
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
    type: 'movie',
    candidates: any[],
  ) {
    const tasks = candidates.map((cand) => async (): Promise<any> => {
      try {
        const videosData = await this.tmdb(
          `${type}/${cand.id}/videos?language=en-US`,
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

    return this.withConcurrencyLimit(tasks, 6);
  }

  async getSmartRecommendationsMovie(
    id: number,
    limit = 10,
    minRequired = 3,
  ): Promise<TmdbMovie[]> {
    try {
      const baseItem = await this.tmdb(
        `movie/${id}?language=en-US`,
      );
      if (!baseItem) return [];

      const baseLang = baseItem.original_language;
      const baseGenreIds: number[] = (baseItem.genres ?? []).map(
        (g: any) => g.id,
      );
      const baseCountries: string[] =
        baseItem.production_countries?.map((c: any) => c.iso_3166_1) ?? [];

      const allCandidates: any[] = [];
      const seenIds = new Set<number>([id]);

      if (baseItem.belongs_to_collection?.id) {
        try {
          const collData = await this.tmdb(
            `collection/${baseItem.belongs_to_collection.id}?language=en-US`,
          );
          const parts = (collData?.parts ?? []).filter((p: any) => p.id !== id);
          for (const part of parts) {
            if (!seenIds.has(part.id)) {
              allCandidates.push({
                ...part,
                source: 'collection',
                priority: 1,
              });
              seenIds.add(part.id);
            }
          }
        } catch (err) {
          this.logger.warn(`Collection fetch failed for movie/${id}`, err);
        }
      }

      const [recData, simData] = await Promise.allSettled([
        this.tmdb(
          `movie/${id}/recommendations?language=en-US&page=1`,
        ),
        this.tmdb(`movie/${id}/similar?language=en-US&page=1`),
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

      if (allCandidates.length < limit * 2 && baseGenreIds.length > 0) {
        try {
          const genreQuery = baseGenreIds.slice(0, 2).join(',');
          const discoverUrl = `discover/movie?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

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
          this.logger.warn(`Genre discovery failed for movie/${id}`, err);
        }
      }

      if (allCandidates.length < minRequired * 2) {
        try {
          const popularData = await this.tmdb(
            `movie/popular?language=en-US&page=1`,
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
          this.logger.warn(`Popular fallback failed for movie/${id}`, err);
        }
      }

      const scored = this.scoreCandidates(
        allCandidates,
        baseLang,
        baseGenreIds,
        baseCountries,
      );

      const topCandidates = scored.slice(
        0,
        Math.max(limit * 3, minRequired * 5),
      );
      const withTrailerInfo = await this.fetchTrailersForCandidates(
        'movie',
        topCandidates,
      );

      const withTrailers = withTrailerInfo.filter((i) => i.hasTrailer);
      const withoutTrailers = withTrailerInfo.filter((i) => !i.hasTrailer);
      let finalCandidates = [...withTrailers, ...withoutTrailers];

      if (finalCandidates.length < minRequired) {
        this.logger.warn(
          `Only found ${finalCandidates.length} movie recommendations for ${id}`,
        );
      }

      const final: TmdbMovie[] = finalCandidates
        .slice(0, limit)
        .map((item: any) => ({
          id: item.id,
          title: item.title || item.name || 'Untitled',
          overview: item.overview || '',
          poster_path: item.poster_path || null,
          backdrop_path: item.backdrop_path || null,
          release_date: item.release_date || item.first_air_date || null,
          vote_average: item.vote_average,
          vote_count: item.vote_count,
          popularity: item.popularity,
          origin_country: item.origin_country || [],
          genres: (item.genre_ids || []).map(
            (gid: number) => this.genreMap[gid] || 'Unknown',
          ),
          trailer_key: item.trailer_key,
          type: 'movie',
        }));

      return final;
    } catch (err) {
      this.logger.error(
        `getSmartRecommendationsMovie failed for movie/${id}`,
        err,
      );
      return [];
    }
  }

  async getKoreaTrending(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;

      const maxPages = page !== undefined ? 20 : 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const movieData = await this.tmdb(
          `discover/movie?with_original_language=ko&sort_by=popularity.desc&page=${currentPage}&include_adult=false&without_keywords=13090,190720`,
        );

        const results = movieData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        currentPage++;

        if (filtered.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const items: TmdbMovie[] = uniqueItems.map((m) => {
        const type = 'movie'
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
          recommendations: [],
        };
      });

      if (!page) {
        const homepageItems = items.slice(0, minRequired);
        this.populateRecommendationsBackground(homepageItems);
        return homepageItems;
      }

      const total = items.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = items.slice(startIndex, endIndex);

      this.populateRecommendationsBackground(paginatedData);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch koreaTrending', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
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

  // OPTIMIZED: Enhanced Trailers with better filtering and fallbacks
  async getTrailers(limit = 30): Promise<TmdbMovie[]> {
    const ttlSec = this.CACHE_TTL.TRAILERS;
    // const cacheKey = `trailers-enhanced-${limit}`;

    // // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         const parsed = JSON.parse(cached) as TmdbMovie[];
    //         return parsed;
    //     } catch { }
    // }
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      // Multi-source approach to get diverse content with trailers
      const sources = [
        // Korean content (original focus)
        `discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1`,
        // Popular movie with high ratings (likely to have trailers)
        `movie/popular?language=en-US&page=1`,
        // Top rated movie (quality content)
        `movie/top_rated?language=en-US&page=1`,
        // Recent releases (likely to have trailers)
        `discover/movie?sort_by=release_date.desc&first_air_date.gte=${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&page=1`,
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
        .slice(0, minRequired * 2)
        .map((m: any) => async (): Promise<TmdbMovie | null> => {
          try {
            const type = 'movie'; // Focus on TV series

            // Fetch videos, details, and additional info in parallel
            const [videosData, details] = await Promise.all([
              this.tmdb(
                `${type}/${m.id}/videos?language=en-US`,
              ),
              this.tmdb(`${type}/${m.id}?language=en-US`).catch(
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

      const withTrailers = (await this.withConcurrencyLimit(trailerTasks, 3))
        .filter((item): item is TmdbMovie => item !== null)
        .slice(0, minRequired);

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

  // Keep existing methods with optimizations
  async getFavorites(limit = 30): Promise<TmdbMovie[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty favorites');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const data = await this.tmdb(`/trending/movie/day?page=${page}`);
        const results = data?.results ?? [];
        const filtered = results.filter((item: any) => item.media_type === 'movie');
        const clean = this.filterAdultishContent(filtered);

        allResults.push(...clean);
        page++;

        if (clean.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const all: TmdbMovie[] = uniqueItems.map((m: any) => ({
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
      return shuffled.slice(0, minRequired);
    } catch (err) {
      this.logger.error('Failed to fetch favorites', err as any);
      return [];
    }
  }

  // Legacy methods kept for compatibility
  async getRecommendations(id: number, limit = 10): Promise<TmdbMovie[]> {
    return this.getSmartRecommendationsMovie(id, limit);
  }

  private readonly BANNED_WORDS = [
    // Korean + English keywords often signaling erotic content
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

  // Genre IDs you consider suspicious — tune as needed.
  private readonly BANNED_GENRE_IDS = new Set<number>([
    // put genre ids you want to block (be careful: 10749 = Romance might be too broad)
    /* e.g. 10749, */ 2916,
    3568, 2972, 10364,
  ]);

  private readonly MIN_VOTE_COUNT = 20; // discard very low-vote items (often low-quality adult content)

  /**
   * Checks if a single TMDB result (movie/tv/object from discover/trending) looks adult/erotic.
   */
  private isAdultishItem(m: any): boolean {
    // normalize texts
    const title = (m.title ?? m.name ?? '').toString().toLowerCase();
    const overview = (m.overview ?? '').toString().toLowerCase();

    // 1) keyword match in title/overview
    for (const bad of this.BANNED_WORDS) {
      if (title.includes(bad) || overview.includes(bad)) return true;
    }

    // 2) genre id match
    if (
      Array.isArray(m.genre_ids) &&
      m.genre_ids.some((g: number) => this.BANNED_GENRE_IDS.has(g))
    ) {
      return true;
    }

    // 3) explicit TMDB adult flag if present
    if (m.adult === true) return true;

    // 4) low vote_count heuristic (optional but useful)
    if (
      typeof m.vote_count === 'number' &&
      m.vote_count < this.MIN_VOTE_COUNT
    ) {
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
    return people.filter((person) => {
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
      const lowVotes = knownFor.filter(
        (k: any) => (k.vote_count ?? 0) < this.MIN_VOTE_COUNT,
      ).length;
      if (lowVotes >= Math.ceil(knownFor.length * 0.75)) return false;

      return true;
    });
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
          `trending/movie/week?language=en-US&page=${p}`,
        );
        const results = trendingData?.results ?? [];

        for (const item of results) {
          if (reviews.length >= limit) break;

          const reviewPromises: Promise<any>[] = [];
          for (let rp = 1; rp <= reviewPages; rp++) {
            const reviewUrl = `movie/${item.id}/reviews?language=en-US&page=${rp}`;
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

  async getUpcomingTrailers(limit = 30): Promise<TmdbMovie[]> {
    const ttlSec = this.CACHE_TTL.TRAILERS;
    const cacheKey = `trailers-upcoming-${limit}`;

    // const cached = await this.redisService.get(cacheKey);
    // if (cached) {
    //     try {
    //         return JSON.parse(cached) as TmdbMovie[];
    //     } catch { }
    // }
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      const items: TmdbMovie[] = [];
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const maxPages = 20;

      const fetchTrailers = async (mediaType: 'movie') => {
        for (let page = 1; page <= maxPages && items.length < minRequired; page++) {
          const url = `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`;

          const data = await this.tmdb(url);
          const clean = this.filterAdultishContent(data);

          const results = data?.results ?? [];

          // Process with concurrency control
          const trailerTasks = results.map((m: any) => async () => {
            const rd = m.release_date ?? m.first_air_date;
            if (!rd || new Date(rd) < today) return null;

            try {
              // Fetch videos and details in parallel
              const [videosData, details] = await Promise.all([
                this.tmdb(
                  `movie/${m.id}/videos?language=en-US`,
                ),
                this.tmdb(`movie/${m.id}?language=en-US`),
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
                runtime:
                  mediaType === 'movie' ? (details.runtime ?? null) : null,
                genres: details.genres
                  ? details.genres.map((g: any) => g.name)
                  : [],
              } as TmdbMovie;
            } catch {
              return null;
            }
          });

          const pageResults = (
            await this.withConcurrencyLimit(trailerTasks)
          ).filter((item): item is TmdbMovie => item !== null);

          items.push(...pageResults);

          if (items.length >= limit) break;
        }
      };

      // Fetch both movie and TV concurrently
      await Promise.all([fetchTrailers('movie')]);

      const withImages = items.filter((item) => item.backdrop_path !== null && item.poster_path !== null);

      const uniqueItems = Array.from(
        new Map(withImages.map((item) => [item.id, item])).values()
      );
      // Sort by release date and limit
      const sorted = uniqueItems
        .sort(
          (a, b) =>
            (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
            (b.release_date ? new Date(b.release_date).getTime() : Infinity),
        )
        .slice(0, minRequired);

      // Populate recommendations in background (don't await)
      setTimeout(async () => {
        const tasks = sorted.map((item) => async () => {
          try {
            item.recommendations = await this.getSmartRecommendationsMovie(
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

  // NEW: Separate endpoint to get recommendations for a specific item
  async getItemRecommendations(
    type: 'movie' | 'tv',
    id: number,
    limit: number,
  ): Promise<TmdbMovie[]> {
    return this.getSmartRecommendationsMovie(id, limit);
  }

  // NEW: Batch trailer fetching for multiple items
  async getTrailersForItems(
    items: { type: 'movie'; id: number }[],
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
          `${item.type}/${item.id}/videos?language=en-US`,
        );
        const trailer = (videosData?.results ?? []).find(
          (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
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

  async getNewReleases(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn("TMDB_API_KEY not set; returning empty new releases");
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      const currentYear = new Date().getFullYear();
      const items: TmdbMovie[] = [];

      // Fetch MORE pages (20 instead of 5)
      const maxPages = 20;

      // Fetch popular movies from this year
      for (let currentPage = 1; currentPage <= maxPages && items.length < minRequired * 2; currentPage++) {
        const url = `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_year=${currentYear}&page=${currentPage}&include_adult=false`;

        try {
          const data = await this.tmdb(url);
          const results = data?.results ?? [];

          // Less strict filtering - just basic content check
          const filtered = results.filter((m: any) => {
            return (
              m.id &&
              (m.title || m.name) &&
              m.poster_path && // Only require poster
              m.release_date
            );
          });

          // Map to TmdbMovie format (NO trailer fetching!)
          const mapped: TmdbMovie[] = filtered.map((m: any) => ({
            id: m.id,
            title: m.title ?? "Untitled",
            overview: m.overview ?? "",
            poster_path: m.poster_path ?? null,
            backdrop_path: m.backdrop_path ?? null,
            release_date: m.release_date,
            vote_average: m.vote_average ?? 0,
            vote_count: m.vote_count ?? 0,
            popularity: m.popularity ?? 0,
            origin_country: m.origin_country ?? [],
            type: "movie",
            recommendations: [],
            genres: m.genre_ids
              ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
              : [],
          }));

          items.push(...mapped);
        } catch (err) {
          this.logger.warn(`Failed to fetch page ${currentPage}`, err);
        }
      }

      // Deduplicate
      const uniqueItems = Array.from(
        new Map(items.map((i) => [i.id, i])).values()
      );

      // Sort by release date (most recent first)
      const sorted = uniqueItems.sort(
        (a, b) =>
          new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime()
      );

      // If page parameter is provided, return paginated format
      if (page !== undefined) {
        const total = sorted.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = sorted.slice(startIndex, endIndex);

        return {
          data: paginatedData,
          page,
          totalPages,
          total,
        };
      }

      // Otherwise return simple array (backwards compatible)
      return sorted.slice(0, limit);
    } catch (err) {
      this.logger.error("Failed to fetch new movie releases", err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  async getActionMovies(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty actionMovies');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;

      const maxPages = 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const movieData = await this.tmdb(
          `discover/movie?with_genres=28&sort_by=popularity.desc&page=${currentPage}&include_adult=false&vote_count.gte=500`,
        );

        const results = movieData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        currentPage++;

        if (filtered.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const items: TmdbMovie[] = uniqueItems.map((m) => ({
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
        type: 'movie',
        recommendations: [],
      }));

      if (!page) {
        const homepageItems = items.slice(0, minRequired);
        this.populateRecommendationsBackground(homepageItems);
        return homepageItems;
      }

      const paginationPool = items.slice(0, minRequired);
      const total = paginationPool.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = paginationPool.slice(startIndex, endIndex);

      this.populateRecommendationsBackground(paginatedData);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch actionMovies', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  async getAnimatedMovies(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty animatedMovies');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;

      const maxPages = 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const movieData = await this.tmdb(
          `discover/movie?with_genres=16&sort_by=popularity.desc&page=${currentPage}&include_adult=false&vote_count.gte=300`,
        );

        const results = movieData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        currentPage++;

        if (filtered.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const items: TmdbMovie[] = uniqueItems.map((m) => ({
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
        type: 'movie',
        recommendations: [],
      }));

      if (!page) {
        const homepageItems = items.slice(0, minRequired);
        this.populateRecommendationsBackground(homepageItems);
        return homepageItems;
      }

      const paginationPool = items.slice(0, minRequired);
      const total = paginationPool.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = paginationPool.slice(startIndex, endIndex);

      this.populateRecommendationsBackground(paginatedData);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch animatedMovies', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  // Get Documentary Movies
  async getDocumentaryMovies(limit = 25): Promise<TmdbMovie[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty documentaryMovies');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const movieData = await this.tmdb(
          `discover/movie?with_genres=99&sort_by=vote_average.desc&page=${page}&include_adult=false&vote_count.gte=200`,
        );

        const results = movieData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        page++;

        if (filtered.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const items: TmdbMovie[] = uniqueItems.slice(0, minRequired).map((m) => ({
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
        type: 'movie',
        recommendations: [],
      }));

      const shuffled = shuffleArray(items);
      this.populateRecommendationsBackground(shuffled);

      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch documentaryMovies', err as any);
      return [];
    }
  }

  async getAwardWinners(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty awardWinners');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;

      const maxPages = 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const movieData = await this.tmdb(
          `discover/movie?sort_by=vote_average.desc&page=${currentPage}&include_adult=false&vote_count.gte=700&vote_average.gte=7.0`,
        );

        const results = movieData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        currentPage++;

        if (filtered.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const items: TmdbMovie[] = uniqueItems.map((m) => ({
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
        type: 'movie',
        recommendations: [],
      }));

      if (!page) {
        const homepageItems = items.slice(0, minRequired);
        this.populateRecommendationsBackground(homepageItems);
        return homepageItems;
      }

      const paginationPool = items.slice(0, minRequired);
      const total = paginationPool.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = paginationPool.slice(startIndex, endIndex);

      this.populateRecommendationsBackground(paginatedData);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch awardWinners', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  async getIndieMovies(
    limit = 30,
    page?: number
  ): Promise<TmdbMovie[] | { data: TmdbMovie[], page: number, totalPages: number, total: number }> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty indieMovies');
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }

    try {
      let allResults: any[] = [];
      let currentPage = 1;

      const maxPages = 5;

      while (allResults.length < minRequired && currentPage <= maxPages) {
        const movieData = await this.tmdb(
          `discover/movie?with_genres=18&sort_by=vote_average.desc&page=${currentPage}&include_adult=false&vote_count.gte=100&vote_count.lte=5000&vote_average.gte=7.0`,
        );

        const results = movieData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        currentPage++;

        if (filtered.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const items: TmdbMovie[] = uniqueItems.map((m) => ({
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
        type: 'movie',
        recommendations: [],
      }));

      if (!page) {
        const homepageItems = items.slice(0, minRequired);
        this.populateRecommendationsBackground(homepageItems);
        return homepageItems;
      }

      const paginationPool = items.slice(0, minRequired);
      const total = paginationPool.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = paginationPool.slice(startIndex, endIndex);

      this.populateRecommendationsBackground(paginatedData);

      return {
        data: paginatedData,
        page,
        totalPages,
        total,
      };
    } catch (err) {
      this.logger.error('Failed to fetch indieMovies', err as any);
      return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
    }
  }

  async images(id: number, type: string) {
    const data = await this.tmdb(`${type}/${id}/images`);
    if (!data) return { posters: [], backdrops: [] };

    const THRESHOLD = 2.5;

    const filterThreshold = (images: any[] = []) => {
      const above = images.filter(img => img?.vote_average && img.vote_average >= THRESHOLD);
      return (above.length > 0 ? above : images)
        .map(img => img?.file_path ?? null)
        .filter((f: string | null): f is string => Boolean(f));
    }

    const posters: string[] = filterThreshold(data?.posters);
    const backdrops: string[] = filterThreshold(data?.backdrops);

    return { posters, backdrops };
  }

  async videos(id: number, type: string) {
    const data = await this.tmdb(`${type}/${id}/videos`);
    if (!data) return { videos: [] };

    const PRIORITY_TYPES = ['Trailer', 'Teaser', 'Clip', 'Featurette'];
    const MIN_SIZE = 720; // Minimum video quality (720p or higher)

    const videos: Array<{
      id: string;
      key: string;
      name: string;
      site?: string | null;
      type?: string | null;
      size?: number | null;
      official: boolean;
      iso_639_1?: string | null;
      iso_3166_1?: string | null;
      published_at?: string | null;
    }> = (data.results ?? [])
      .filter((v: any) => {
        return (
          Boolean(v?.key) &&
          (v?.site?.toLowerCase() === 'youtube') &&
          Boolean(v?.official) && // Official content only
          (typeof v?.size === 'number' ? v.size >= MIN_SIZE : true) && // HD quality or unknown
          PRIORITY_TYPES.includes(v?.type) // Relevant video types
        );
      })
      .sort((a: any, b: any) => {
        const typeOrder = (type: string) => PRIORITY_TYPES.indexOf(type);

        const aPriority = typeOrder(a.type);
        const bPriority = typeOrder(b.type);

        if (aPriority !== bPriority) return aPriority - bPriority;

        const aSize = a.size ?? 0;
        const bSize = b.size ?? 0;
        if (aSize !== bSize) return bSize - aSize; // Higher quality first

        const aDate = new Date(a.published_at ?? 0).getTime();
        const bDate = new Date(b.published_at ?? 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 30)
      .map((v: any) => ({
        id: v?.id ?? "",
        key: v?.key ?? "",
        name: v?.name ?? "",
        site: v?.site ?? null,
        type: v?.type ?? null,
        size: typeof v?.size === "number" ? v.size : null,
        official: Boolean(v?.official),
        iso_639_1: v?.iso_639_1 ?? null,
        iso_3166_1: v?.iso_3166_1 ?? null,
        published_at: v?.published_at ?? null,
      }));

    return { videos };
  }

}
