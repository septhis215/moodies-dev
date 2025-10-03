import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type ContentType = 'tv';

export type TmdbTv = {
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
  private readonly MIN_REQUIRED_ITEMS = 25;

  private readonly CACHE_TTL = {
    BASIC_DATA: 60 * 5,
    RECOMMENDATIONS: 60 * 30,
    TRAILERS: 60 * 60,
    GENRES: 60 * 60 * 24,
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

  private async tmdb(endpoint: string) {
    let normalizedEndpoint: string;

    if (endpoint.startsWith('http')) {
      normalizedEndpoint = endpoint;
    } else {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
      const cleanBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
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

  async tvDetails(id: number, p0: any) {
    const detectedType: ContentType = 'tv';

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

    const videos = videosRaw?.results ?? videosRaw ?? [];
    const trailer =
      (videos || []).find(
        (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
      ) ?? null;

    const production_countries =
      infoRaw?.production_countries ??
      (infoRaw?.origin_country
        ? (infoRaw.origin_country as string[]).map((c) => ({ iso_3166_1: c }))
        : []);

    const director =
      (creditsRaw?.crew ?? []).find((c: any) => c.job === 'Director')?.name ??
      (infoRaw?.created_by && infoRaw.created_by[0]?.name) ??
      undefined;

    const getContentRating = (
      ratingsData: any,
      fallbackCountries: string[] = ['GB', 'CA', 'AU', 'FR', 'DE', 'IN', 'JP'],
    ): string => {
      if (!ratingsData) return 'NR';

      const results = ratingsData?.results ?? [];

      const findRatingForCountry = (countryCode: string) => {
        const countryObj = results.find(
          (r: any) => r.iso_3166_1 === countryCode,
        );
        if (!countryObj || !countryObj.rating) return null;
        const rating = String(countryObj.rating).trim();
        return rating === '' ? null : rating;
      };

      const normalizeTvRating = (rating: string | null | undefined): string => {
        if (!rating) return 'NR';
        const r = String(rating).toUpperCase();

        if (r.includes('MA') || r === 'TV-MA') return 'TV-MA';
        if (r.includes('14') || r === 'TV-14') return 'TV-14';
        if (r.includes('PG') || r === 'TV-PG') return 'TV-PG';
        if (r.includes('G') || r === 'TV-G') return 'TV-G';
        if (r.includes('Y7') || r === 'TV-Y7') return 'TV-Y7';
        if (r === 'Y' || r === 'TV-Y') return 'TV-Y';

        return rating;
      };

      const us = findRatingForCountry('US');
      if (us) return normalizeTvRating(us);

      for (const country of fallbackCountries) {
        const r = findRatingForCountry(country);
        if (r) return normalizeTvRating(r);
      }

      for (const obj of results) {
        const r = obj?.rating;
        if (r && String(r).trim() !== '') return normalizeTvRating(r);
      }

      return 'NR';
    };

    const contentRating = getContentRating(contentRatingsRaw);

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
      content_type: detectedType,
      director,
      content_rating: contentRating,
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

  private getRecentDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  private readonly BANNED_WORDS = [
    '에로', '성인', '야한', '포르노', '섹스', '성적', '노출', '관음', '야설',
    'porn', 'sex', 'xxx', 'erotic', 'adult', 'nude', 'av',
  ];

  private readonly BANNED_GENRE_IDS = new Set<number>([
    2916, 3568, 2972, 10364,
  ]);

  private readonly MIN_VOTE_COUNT = 20;

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
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty featured');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const tv = await this.tmdb(
          `/discover/tv?sort_by=popularity.desc&include_adult=false&page=${page}&first_air_date.gte=${this.getRecentDate(365)}&without_keywords=13090,190720`,
        );

        const results = tv?.results ?? [];
        allResults.push(...results);
        page++;

        if (results.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const tvContent: TmdbTv[] = uniqueItems.map((m: any) => ({
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
      const sliced = shuffled.slice(0, minRequired);

      return sliced;
    } catch (err) {
      this.logger.error('Failed to fetch featured', err as any);
      return [];
    }
  }

  async getTrending(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trending');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const data = await this.tmdb(`/trending/tv/day?include_adult=false&page=${page}`);

        const results = (data?.results ?? []).filter((m: any) => {
          const date = new Date(m.release_date ?? m.first_air_date ?? '');
          return date >= new Date(this.getRecentDate(365));
        });

        allResults.push(...results);
        page++;

        if (results.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const basicItems: TmdbTv[] = uniqueItems
        .slice(0, minRequired)
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
          recommendations: [],
        }));

      const shuffled = shuffleArray(basicItems);
      this.populateRecommendationsBackground(shuffled);

      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch trending', err as any);
      return [];
    }
  }

  async airingToday(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty airing today');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const data = await this.tmdb(`/tv/airing_today?language=en-US&page=${page}`);
        const results = data?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        page++;

        if (filtered.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const items: TmdbTv[] = uniqueItems
        .slice(0, minRequired)
        .map((m) => this.mapToTmdbTv(m, true));

      const shuffled = shuffleArray(items);
      this.populateRecommendationsBackground(shuffled);

      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch airing today', err as any);
      return [];
    }
  }

  async airingThisWeek(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty airing this week');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const data = await this.tmdb(`/tv/on_the_air?language=en-US&page=${page}`);
        const results = data?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        page++;

        if (filtered.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const items: TmdbTv[] = uniqueItems
        .slice(0, minRequired)
        .map((m) => this.mapToTmdbTv(m, true));

      const shuffled = shuffleArray(items);
      this.populateRecommendationsBackground(shuffled);

      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch airing this week', err as any);
      return [];
    }
  }

  async getFavorites(limit = 30): Promise<TmdbTv[]> {
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
        const data = await this.tmdb(`/trending/tv/day?page=${page}`);
        const results = data?.results ?? [];
        const filtered = results.filter((item: any) => item.media_type === 'tv');
        const clean = this.filterAdultishContent(filtered);

        allResults.push(...clean);
        page++;

        if (clean.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const all: TmdbTv[] = uniqueItems.map((m: any) => ({
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

  async getRevenue(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty revenue');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const data = await this.tmdb(
          `/discover/tv?language=en-US&sort_by=revenue.desc&page=${page}`,
        );
        const results = data?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        page++;

        if (filtered.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const items: TmdbTv[] = uniqueItems
        .slice(0, minRequired)
        .map((m) => this.mapToTmdbTv(m, true));

      const shuffled = shuffleArray(items);
      this.populateRecommendationsBackground(shuffled);

      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch revenue TV', err as any);
      return [];
    }
  }

  async tvByGenres(
    ids: string,
    useAnd: boolean = false,
    limit = 30,
  ): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty genre results');
      return [];
    }

    try {
      const genresParam = useAnd ? ids : ids.replace(/,/g, '|');
      const today = new Date();
      const fiveYearsAgo = new Date(today.getFullYear() - 5, 0, 1);
      const gteDate = fiveYearsAgo.toISOString().split('T')[0];

      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const url =
          `/discover/tv?language=en-US&page=${page}` +
          `&with_genres=${genresParam}` +
          `&include_adult=false` +
          `&include_null_first_air_dates=false` +
          `&sort_by=first_air_date.desc` +
          `&first_air_date.gte=${gteDate}` +
          `&vote_count.gte=50`;

        const data = await this.tmdb(url);
        const results = data?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        page++;

        if (filtered.length === 0) break;
      }
      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );
      const items: TmdbTv[] = uniqueItems
        .slice(0, minRequired)
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

  async getSmartRecommendationsTv(
    id: number,
    limit = 10,
    minRequired = 3,
  ): Promise<TmdbTv[]> {
    try {
      const baseItem = await this.tmdb(`tv/${id}?language=en-US`);
      if (!baseItem) return [];

      const baseLang = baseItem.original_language;
      const baseGenreIds: number[] = (baseItem.genres ?? []).map(
        (g: any) => g.id,
      );
      const baseCountries: string[] = baseItem.origin_country ?? [];

      const allCandidates: any[] = [];
      const seenIds = new Set<number>([id]);

      const [recData, simData] = await Promise.allSettled([
        this.tmdb(`tv/${id}/recommendations?language=en-US&page=1`),
        this.tmdb(`tv/${id}/similar?language=en-US&page=1`),
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
          const discoverUrl = `discover/tv?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

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

      if (allCandidates.length < minRequired * 2) {
        try {
          const popularData = await this.tmdb(`tv/popular?language=en-US&page=1`);
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

  async getKoreaTrending(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty koreaTrending');
      return [];
    }

    try {
      let allResults: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (allResults.length < minRequired && page <= maxPages) {
        const tvData = await this.tmdb(
          `discover/tv?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`,
        );

        const results = tvData?.results ?? [];
        const filtered = this.filterAdultishContent(results);

        allResults.push(...filtered);
        page++;

        if (filtered.length === 0) break;
      }

      const uniqueItems = Array.from(
        new Map(allResults.map((item) => [item.id, item])).values()
      );

      const items: TmdbTv[] = uniqueItems.slice(0, minRequired).map((m) => {
        const type = 'tv'
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

      const shuffled = shuffleArray(items);
      this.populateRecommendationsBackground(shuffled);

      return shuffled;
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
          `trending/tv/week?language=en-US&page=${p}`,
        );
        const results = trendingData?.results ?? [];

        for (const item of results) {
          if (reviews.length >= limit) break;

          const reviewPromises: Promise<any>[] = [];
          for (let rp = 1; rp <= reviewPages; rp++) {
            const reviewUrl = `tv/${item.id}/reviews?language=en-US&page=${rp}`;
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
      return shuffled;
    } catch (err) {
      this.logger.error('Failed to fetch trending reviews', err as any);
      return [];
    }
  }

  async getNewReleases(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty new releases');
      return [];
    }

    try {
      const items: TmdbTv[] = [];
      const today = new Date();
      const maxPages = 20;
      // last 7 days
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      const lastWeekStr = lastWeek.toISOString().split("T")[0];

      // next 7 days
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split("T")[0];

      for (let page = 1; page <= maxPages && items.length < minRequired; page++) {
        const url = `discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${lastWeekStr}&first_air_date.lte=${nextWeekStr}&page=${page}`;

        const data = await this.tmdb(url);
        const results = data?.results ?? [];

        const trailerTasks = results.map((m: any) => async () => {
          const rd = m.first_air_date;

          try {
            const [videosData, details] = await Promise.all([
              this.tmdb(`tv/${m.id}/videos?language=en-US`),
              this.tmdb(`tv/${m.id}?language=en-US`),
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
              type: 'tv' as ContentType,
              recommendations: [],
              number_of_episodes: details.number_of_episodes ?? null,
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
      }

      const withImages = items.filter((item) => item.backdrop_path !== null && item.poster_path !== null);

      // Deduplicate by `id`
      const uniqueItems = Array.from(
        new Map(withImages.map((item) => [item.id, item])).values()
      );
      // ---- Priority sorting ----
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = new Date(today); yesterdayStr.setDate(today.getDate() - 1);
      const tomorrowStr = new Date(today); tomorrowStr.setDate(today.getDate() + 1);
      const next2Str = new Date(today); next2Str.setDate(today.getDate() + 2);

      const priorityDates = new Set([
        yesterdayStr.toISOString().split("T")[0],
        todayStr,
        tomorrowStr.toISOString().split("T")[0],
        next2Str.toISOString().split("T")[0],
      ]);

      const [priority, others] = uniqueItems.reduce<[TmdbTv[], TmdbTv[]]>(
        (acc, item) => {
          if (priorityDates.has(item.release_date)) acc[0].push(item);
          else acc[1].push(item);
          return acc;
        },
        [[], []],
      );

      // Sort priority by exact date (today first, then ±1, then +2)
      const orderedPriority = priority.sort(
        (a, b) =>
          new Date(a.release_date).getTime() - new Date(b.release_date).getTime(),
      );

      // Sort others normally by date
      const orderedOthers = others.sort(
        (a, b) =>
          new Date(a.release_date).getTime() - new Date(b.release_date).getTime(),
      );

      // Combine: priority first, then others
      const sorted = [...orderedPriority, ...orderedOthers].slice(0, limit);

      return sorted;
    } catch (err) {
      this.logger.error('Failed to fetch upcoming trailers', err as any);
      return [];
    }
  }
  
  async getUpcomingTrailers(limit = 60): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      const items: TmdbTv[] = [];
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const maxPages = 20;
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 3);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];

      for (let page = 1; page <= maxPages && items.length < minRequired; page++) {
        const url = `discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&first_air_date.lte=${nextMonthStr}&page=${page}`;

        const data = await this.tmdb(url);
        const results = data?.results ?? [];

        const trailerTasks = results.map((m: any) => async () => {
          const rd = m.release_date ?? m.first_air_date;

          try {
            const [videosData, details] = await Promise.all([
              this.tmdb(`tv/${m.id}/videos?language=en-US`),
              this.tmdb(`tv/${m.id}?language=en-US`),
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
              type: 'tv' as ContentType,
              recommendations: [],
              number_of_episodes: details.number_of_episodes ?? null,
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
      }

      const withImages = items.filter((item) => item.backdrop_path !== null && item.poster_path !== null);

      // Deduplicate by `id`
      const uniqueItems = Array.from(
        new Map(withImages.map((item) => [item.id, item])).values()
      );
      const sorted = uniqueItems
        .sort(
          (a, b) =>
            (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
            (b.release_date ? new Date(b.release_date).getTime() : Infinity),
        )
        .slice(0, limit);

      return sorted;
    } catch (err) {
      this.logger.error('Failed to fetch upcoming trailers', err as any);
      return [];
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


  // Get trailer for TV show
  async getTrailers(limit = 30): Promise<TmdbTv[]> {
    const minRequired = Math.max(this.MIN_REQUIRED_ITEMS, limit);

    if (!this.token) {
      this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
      return [];
    }

    try {
      const sources = [
        `discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1`,
        `tv/popular?language=en-US&page=1`,
        `tv/top_rated?language=en-US&page=1`,
        `discover/tv?sort_by=release_date.desc&first_air_date.gte=${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&page=1`,
      ];

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

      const uniqueItems: any[] = [];
      const seenIds = new Set<number>();
      for (const item of allResults) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueItems.push(item);
        }
      }

      const trailerTasks = uniqueItems
        .slice(0, minRequired * 2)
        .map((m: any) => async (): Promise<TmdbTv | null> => {
          try {
            const [videosData, details] = await Promise.all([
              this.tmdb(`tv/${m.id}/videos?language=en-US`),
              this.tmdb(`tv/${m.id}?language=en-US`).catch(() => null),
            ]);

            const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
            let trailer: any = null;

            for (const trailerType of trailerTypes) {
              trailer = (videosData?.results ?? []).find(
                (v: any) => v.type === trailerType && v.site === 'YouTube',
              );
              if (trailer) break;
            }

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
              recommendations: [],
              runtime: undefined,
              genres: details?.genres
                ? details.genres.map((g: any) => g.name)
                : [],
              origin_country: details?.origin_country ?? m.origin_country ?? [],
              type: 'tv',
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
        .filter((item): item is TmdbTv => item !== null)
        .slice(0, minRequired);

      this.populateRecommendationsBackground(withTrailers);

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
    const tasks = items.map((item) => async () => {
      try {
        const videosData = await this.tmdb(`tv/${item.id}/videos?language=en-US`);
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

    return trailerMap;
  }
}