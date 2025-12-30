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
  original_language?: string;
  recommendations?: TmdbAll[];
  type?: 'movie' | 'tv';
  trailer_key?: string | null;
  network?: string; // for tv
  created_by?: string; // for tv
  genre_ids?: number[]; // for internal use
  runtime?: number; // for movie
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
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private genreMap: Record<number, string> = {};
  private readonly maxConcurrentRequests = 5; // TMDB rate limit consideration

  // Cache TTL constants
  private readonly CACHE_TTL = {
    BASIC_DATA: 60 * 60 * 24, // 5 minutes for trending
    RECOMMENDATIONS: 60 * 60 * 24, // 30 minutes for recommendations
    TRAILERS: 60 * 60 * 24, // 1 hour for trailers
    GENRES: 60 * 60 * 48, // 24 hours for genres
  };

  constructor(
    private readonly httpService: HttpService,
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

      // Fix: Use proper type assertion
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }
    return results;
  }

  // tmdb helper function
  private async tmdb(endpoint: string) {
    const base = this.baseUrl.replace(/\/+$/, ''); // remove trailing slashes
    const path = endpoint.startsWith('http')
      ? endpoint
      : `${base}/${endpoint.replace(/^\/+/, '')}`; // remove leading slashes from endpoint

    try {
      const response = await firstValueFrom(
        this.httpService.get(path, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
          },
        }),
      );

      return response.data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        this.logger.warn(`TMDB 404: ${path}`);
        return null;
      }
      if (status === 429) {
        this.logger.warn(`TMDB rate limited (429) on ${path}`);
        // optionally implement a short retry/backoff here
        return null;
      }
      this.logger.error(`TMDB request failed: ${path}`, err);
      throw err;
    }
  }

  async onModuleInit() {
    await this.initializeGenres();
  }

  // initialize genre map
  private async initializeGenres() {
    try {
      const [movieGenres, tvGenres] = await Promise.all([
        this.tmdb('/genre/movie/list?language=en'),
        this.tmdb('/genre/tv/list?language=en'),
      ]);

      const allGenres = [
        ...(movieGenres?.genres || []),
        ...(tvGenres?.genres || []),
      ];

      for (const genre of allGenres) {
        if (genre.id && genre.name) {
          this.genreMap[genre.id] = genre.name;
        }
      }

      this.logger.log(`Loaded ${Object.keys(this.genreMap).length} genres`);
    } catch (err) {
      this.logger.error('Failed to initialize genres', err);
    }
  }

  private getRecentDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  private readonly MIN_VOTE_COUNT = 20;
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

  private isAdultishItem(m: any): boolean {
    const title = (m.title ?? m.name ?? '').toString().toLowerCase();
    const overview = (m.overview ?? '').toString().toLowerCase();

    for (const bad of this.BANNED_WORDS) {
      if (title.includes(bad) || overview.includes(bad)) return true;
    }

    if (
      Array.isArray(m.genre_ids) &&
      m.genre_ids.some((g: number) => this.BANNED_GENRE_IDS.has(g))
    ) {
      return true;
    }

    if (m.adult === true) return true;

    if (
      typeof m.vote_count === 'number' &&
      m.vote_count < this.MIN_VOTE_COUNT
    ) {
      return true;
    }

    if (m.runtime && m.runtime > 0 && m.runtime < 50) return true;
    return false;
  }

  async getTrending(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: TmdbAll[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trending');
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }

    try {
      // Calculate which TMDB pages we need based on our pagination
      // Each TMDB page has 20 items, so we need to map our page to TMDB pages
      const itemsPerTmdbPage = 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const startTmdbPage = Math.floor(startIndex / itemsPerTmdbPage) + 1;
      const endTmdbPage = Math.floor(endIndex / itemsPerTmdbPage) + 1;

      // Fetch only the required TMDB pages
      const tmdbPagesToFetch: number[] = [];
      for (let p = startTmdbPage; p <= endTmdbPage; p++) {
        tmdbPagesToFetch.push(p);
      }

      const pageTasks = tmdbPagesToFetch.map((p) => {
        return async () => {
          return this.tmdb(`/trending/all/day?page=${p}&include_adult=false`);
        };
      });

      const fetchedPages = await this.withConcurrencyLimit<any>(pageTasks);

      // Get total pages from first response
      const totalTmdbPages = fetchedPages[0]?.total_pages || 1;
      const totalTmdbResults = fetchedPages[0]?.total_results || 0;

      // Collect all results from fetched pages
      const allResultsRaw = fetchedPages.flatMap((page) => page?.results ?? []);

      // Filter by recent date
      const filtered = allResultsRaw.filter((m: any) => {
        const date = new Date(m.release_date ?? m.first_air_date ?? '');
        return date >= new Date(this.getRecentDate(365));
      });

      // Dedupe by id
      const uniqueMap = new Map<number, any>();
      for (const item of filtered) {
        if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
      }
      const uniqueItems = Array.from(uniqueMap.values());

      // Format basic data
      let basicItems: TmdbAll[] = uniqueItems.map((m: any) => ({
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
        (m) =>
          m.type === 'movie' &&
          (!m.origin_country || m.origin_country.length === 0),
      );

      if (movieWithoutCountry.length > 0) {
        const movieDetails = await Promise.allSettled(
          movieWithoutCountry.map((movie) =>
            this.tmdb(`/movie/${movie.id}?language=en-US`).catch(() => null),
          ),
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

      // Calculate which items from the combined results we need
      const startOffset = startIndex % itemsPerTmdbPage;
      const paginatedData = basicItems.slice(startOffset, startOffset + limit);

      // Calculate total pages based on estimated total after filtering
      // Note: This is an approximation since we filter by date
      const estimatedTotal = Math.floor(totalTmdbResults * 0.8); // Assume ~80% pass the date filter
      const totalPagesCalc = Math.ceil(estimatedTotal / limit);

      return {
        data: paginatedData,
        total: estimatedTotal,
        page,
        totalPages: totalPagesCalc,
      };
    } catch (err) {
      this.logger.error('Failed to fetch trending', err as any);
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  async getNewReleases(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: TmdbAll[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty New Releases');
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }

    try {
      // 📅 Date range: last 30 days → today
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);

      const fromStr = fromDate.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      // Pagination math
      const itemsPerTmdbPage = 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const startTmdbPage = Math.floor(startIndex / itemsPerTmdbPage) + 1;
      const endTmdbPage = Math.floor(endIndex / itemsPerTmdbPage) + 1;

      const pagesToFetch: number[] = [];
      for (let p = startTmdbPage; p <= endTmdbPage; p++) {
        pagesToFetch.push(p);
      }

      // 🎬 Movies (recent releases)
      const movieTasks = pagesToFetch.map((p) => async () =>
        this.tmdb(
          `/discover/movie?include_adult=false&language=en-US&page=${p}` +
          `&primary_release_date.gte=${fromStr}` +
          `&primary_release_date.lte=${todayStr}` +
          `&sort_by=popularity.desc`,
        ),
      );

      // 📺 TV (recently aired)
      const tvTasks = pagesToFetch.map((p) => async () =>
        this.tmdb(
          `/discover/tv?include_adult=false&include_null_first_air_dates=false` +
          `&language=en-US&page=${p}` +
          `&first_air_date.gte=${fromStr}` +
          `&first_air_date.lte=${todayStr}` +
          `&sort_by=popularity.desc`,
        ),
      );

      const [moviePages, tvPages] = await Promise.all([
        this.withConcurrencyLimit<any>(movieTasks),
        this.withConcurrencyLimit<any>(tvTasks),
      ]);

      // Estimated totals
      const totalMovieResults = moviePages[0]?.total_results || 0;
      const totalTvResults = tvPages[0]?.total_results || 0;
      const totalTmdbResults = totalMovieResults + totalTvResults;

      // Merge results
      const movieResults = moviePages.flatMap((page) =>
        (page?.results ?? []).map((m: any) => ({ ...m, media_type: 'movie' })),
      );

      const tvResults = tvPages.flatMap((page) =>
        (page?.results ?? []).map((t: any) => ({ ...t, media_type: 'tv' })),
      );

      const allResults = [...movieResults, ...tvResults];

      // ✅ Validate + ensure RECENT (not future)
      const validResults = allResults.filter((item: any) => {
        const releaseDate = new Date(
          item.release_date || item.first_air_date || '',
        );

        const isRecent =
          releaseDate >= fromDate &&
          releaseDate <= today;

        return (
          isRecent &&
          item.id &&
          (item.title || item.name) &&
          item.overview?.trim().length > 0 &&
          item.poster_path &&
          item.backdrop_path &&
          typeof item.vote_average === 'number'
        );
      });

      // Dedupe
      const uniqueMap = new Map<string, any>();
      for (const item of validResults) {
        const key = `${item.media_type}-${item.id}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, item);
      }

      const uniqueItems = Array.from(uniqueMap.values()).sort(
        (a, b) => (b.popularity || 0) - (a.popularity || 0),
      );

      // Format
      const basicItems: TmdbAll[] = uniqueItems.map((m: any) => ({
        id: m.id,
        title: m.title ?? m.name ?? 'Untitled',
        overview: m.overview ?? '',
        poster_path: m.poster_path ?? null,
        backdrop_path: m.backdrop_path ?? null,
        release_date: m.release_date ?? m.first_air_date ?? null,
        vote_average: m.vote_average ?? 0,
        vote_count: m.vote_count ?? 0,
        popularity: m.popularity ?? 0,
        origin_country: m.origin_country ?? [],
        genres: m.genre_ids
          ? m.genre_ids
            .map((id: number) => this.genreMap[id])
            .filter(Boolean)
          : [],
        type: m.media_type,
        recommendations: [],
      }));

      // Paginate combined list
      const startOffset = startIndex % itemsPerTmdbPage;
      const paginatedData = basicItems.slice(startOffset, startOffset + limit);

      const estimatedTotal = Math.floor(totalTmdbResults * 0.8);
      const totalPagesCalc = Math.ceil(estimatedTotal / limit);

      return {
        data: paginatedData,
        total: estimatedTotal,
        page,
        totalPages: totalPagesCalc,
      };
    } catch (err) {
      this.logger.error('Failed to fetch New Releases', err as any);
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  async getKoreaTrending(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: TmdbAll[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }

    try {
      // Calculate which TMDB pages we need based on our pagination
      const itemsPerTmdbPage = 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const startTmdbPage = Math.floor(startIndex / itemsPerTmdbPage) + 1;
      const endTmdbPage = Math.floor(endIndex / itemsPerTmdbPage) + 1;

      // Fetch only the required TMDB pages
      const tmdbPagesToFetch: number[] = [];
      for (let p = startTmdbPage; p <= endTmdbPage; p++) {
        tmdbPagesToFetch.push(p);
      }

      // Fetch Korean TV shows
      const tvTasks = tmdbPagesToFetch.map((p) => async () => {
        return this.tmdb(
          `/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=${p}&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`,
        );
      });

      // Fetch Korean movies
      const movieTasks = tmdbPagesToFetch.map((p) => async () => {
        return this.tmdb(
          `/discover/movie?with_original_language=ko&sort_by=popularity.desc&page=${p}&include_adult=false&without_keywords=13090,190720&certification_country=KR&certification.lte=15`,
        );
      });

      // Fetch both in parallel
      const [tvPages, moviePages] = await Promise.all([
        this.withConcurrencyLimit<any>(tvTasks),
        this.withConcurrencyLimit<any>(movieTasks),
      ]);

      // Get total results from TMDB
      const totalTvResults = tvPages[0]?.total_results || 0;
      const totalMovieResults = moviePages[0]?.total_results || 0;
      const totalTmdbResults = totalTvResults + totalMovieResults;

      // Combine results
      const tvResults = tvPages.flatMap((page) => page?.results ?? []);
      const movieResults = moviePages.flatMap((page) => page?.results ?? []);
      const allResults = [...tvResults, ...movieResults];

      // Post-fetch aggressive filter
      const filtered = this.filterAdultishContent(allResults);

      // Dedupe by id
      const uniqueMap = new Map<number, any>();
      for (const item of filtered) {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      }
      const uniqueItems = Array.from(uniqueMap.values());

      // Sort by popularity (descending - most popular first)
      uniqueItems.sort((a, b) => {
        return (b.popularity || 0) - (a.popularity || 0);
      });

      // Format basic data
      const basicItems: TmdbAll[] = uniqueItems.map((m: any) => {
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
          origin_country: m.origin_country ?? ['KR'],
          genres: m.genre_ids
            ? m.genre_ids.map((id: number) => this.genreMap[id] || 'Unknown')
            : [],
          type,
          recommendations: [],
        };
      });

      // Calculate which items from the combined results we need
      const startOffset = startIndex % itemsPerTmdbPage;
      const paginatedData = basicItems.slice(startOffset, startOffset + limit);

      // Calculate total pages based on estimated total after filtering
      // Note: This is an approximation since we filter adult content
      const estimatedTotal = Math.floor(totalTmdbResults * 0.9); // Assume ~90% pass the filter
      const totalPagesCalc = Math.ceil(estimatedTotal / limit);

      return {
        data: paginatedData,
        total: estimatedTotal,
        page,
        totalPages: totalPagesCalc,
      };
    } catch (err) {
      this.logger.error('Failed to fetch koreaTrending', err as any);
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  async getComingSoon(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: TmdbAll[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty ComingSoon');
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }

    try {
      // Get date range - from today onwards
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const oneYearAhead = new Date(today);
      oneYearAhead.setDate(oneYearAhead.getDate() + 365);
      const futureDate = oneYearAhead.toISOString().split('T')[0];

      // Calculate which TMDB pages we need based on our pagination
      const itemsPerTmdbPage = 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const startTmdbPage = Math.floor(startIndex / itemsPerTmdbPage) + 1;
      const endTmdbPage = Math.floor(endIndex / itemsPerTmdbPage) + 1;

      const pagesToFetch: number[] = [];
      for (let p = startTmdbPage; p <= endTmdbPage; p++) {
        pagesToFetch.push(p);
      }

      // Fetch upcoming movies
      const movieTasks = pagesToFetch.map((p) => async () => {
        return this.tmdb(`/movie/upcoming?language=en-US&page=${p}&region=US`);
      });

      // Fetch TV shows airing from today onwards
      const tvTasks = pagesToFetch.map((p) => async () => {
        return this.tmdb(
          `/discover/tv?include_adult=false&include_null_first_air_dates=false&language=en-US&page=${p}&first_air_date.gte=${todayStr}&first_air_date.lte=${futureDate}&sort_by=popularity.desc`,
        );
      });

      // Fetch both in parallel
      const [moviePages, tvPages] = await Promise.all([
        this.withConcurrencyLimit<any>(movieTasks),
        this.withConcurrencyLimit<any>(tvTasks),
      ]);

      // Get total results from TMDB
      const totalMovieResults = moviePages[0]?.total_results || 0;
      const totalTvResults = tvPages[0]?.total_results || 0;
      const totalTmdbResults = totalMovieResults + totalTvResults;

      // Combine results
      const movieResults = moviePages.flatMap((page) =>
        (page?.results ?? []).map((m: any) => ({ ...m, media_type: 'movie' })),
      );
      const tvResults = tvPages.flatMap((page) =>
        (page?.results ?? []).map((t: any) => ({ ...t, media_type: 'tv' })),
      );

      const allResults = [...movieResults, ...tvResults];

      // Filter out items with missing critical data and ensure they're truly upcoming
      const validResults = allResults.filter((item: any) => {
        const releaseDate = new Date(
          item.release_date || item.first_air_date || '',
        );
        const isUpcoming = releaseDate >= today;

        const hasTitle = !!(item.title || item.name);
        const hasOverview = !!item.overview && item.overview.trim().length > 0;
        const hasPoster = !!item.poster_path;
        const hasBackdrop = !!item.backdrop_path;
        const hasReleaseDate = !!(item.release_date || item.first_air_date);
        const hasValidRating = typeof item.vote_average === 'number';
        const hasId = !!item.id;

        return (
          isUpcoming &&
          hasId &&
          hasTitle &&
          hasOverview &&
          hasPoster &&
          hasBackdrop &&
          hasReleaseDate &&
          hasValidRating
        );
      });

      // Dedupe by id and type
      const uniqueMap = new Map<string, any>();
      for (const item of validResults) {
        const key = `${item.media_type}-${item.id}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }
      const uniqueItems = Array.from(uniqueMap.values());

      // Sort by release date (soonest first) then by popularity
      uniqueItems.sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || '');
        const dateB = new Date(b.release_date || b.first_air_date || '');

        // First sort by date (soonest first)
        const dateDiff = dateA.getTime() - dateB.getTime();
        if (dateDiff !== 0) return dateDiff;

        // If dates are equal, sort by popularity (descending)
        return (b.popularity || 0) - (a.popularity || 0);
      });

      // Format basic data
      let basicItems: TmdbAll[] = uniqueItems
        .map((m: any) => ({
          id: m.id,
          title: m.title ?? m.name ?? 'Untitled',
          overview: m.overview ?? '',
          poster_path: m.poster_path ?? null,
          backdrop_path: m.backdrop_path ?? null,
          release_date: m.release_date ?? m.first_air_date ?? null,
          vote_average: m.vote_average ?? 0,
          vote_count: m.vote_count ?? 0,
          popularity: m.popularity ?? 0,
          origin_country: m.origin_country ?? [],
          genres: m.genre_ids
            ? m.genre_ids
              .map((id: number) => this.genreMap[id])
              .filter((genre) => genre && genre !== 'Unknown')
            : [],
          type: m.media_type,
          recommendations: [],
        }))
        .filter((item) => {
          return (
            item.title &&
            item.title.trim().length > 0 &&
            item.overview &&
            item.overview.trim().length > 0 &&
            item.poster_path &&
            item.backdrop_path &&
            item.release_date &&
            item.genres.length > 0
          );
        });

      // Fetch missing origin countries for movies
      const movieWithoutCountry = basicItems.filter(
        (m) =>
          m.type === 'movie' &&
          (!m.origin_country || m.origin_country.length === 0),
      );

      if (movieWithoutCountry.length > 0) {
        const movieDetails = await Promise.allSettled(
          movieWithoutCountry.map((movie) =>
            this.tmdb(`/movie/${movie.id}?language=en-US`).catch(() => null),
          ),
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

      // Calculate which items from the combined results we need
      const startOffset = startIndex % itemsPerTmdbPage;
      const paginatedData = basicItems.slice(startOffset, startOffset + limit);

      // Use TMDB's total as estimate (accounting for ~80% passing filters)
      const estimatedTotal = Math.floor(totalTmdbResults * 0.8);
      const totalPagesCalc = Math.ceil(estimatedTotal / limit);

      return {
        data: paginatedData,
        total: estimatedTotal,
        page,
        totalPages: totalPagesCalc,
      };
    } catch (err) {
      this.logger.error('Failed to fetch ComingSoon', err as any);
      return { data: [], total: 0, page: 1, totalPages: 0 };
    }
  }
}
