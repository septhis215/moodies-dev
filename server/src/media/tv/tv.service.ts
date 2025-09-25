import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { info } from 'console';
// import { RedisService } from 'src/redis/redis.service';

type ContentType = 'movie' | 'tv';

@Injectable()
export class TvService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly logger = new Logger(TvService.name);

  constructor(
    private readonly httpService: HttpService,
    // private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('TMDB_BASE') ?? '';
    this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
  }

  // Safe tmdb fetch that returns null on 404 and throws otherwise
  private async tmdb(endpoint: string) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
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
        return null;
      }
      // log and rethrow for unexpected errors
      this.logger.error(`tmdb request failed ${url}`, err?.message ?? err);
      throw err;
    }
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
  async tvDetails(id: number) {
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
      (videos || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ??
      null;


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
        const countryObj = results.find((r: any) => r.iso_3166_1 === countryCode);
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
      status: infoRaw?.status ?? (infoRaw?.in_production ? 'In Production' : 'Released'),
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
      cast: (creditsRaw?.cast ?? []).sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999)),
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
    options: { includeEpisodeDetails?: boolean } = { includeEpisodeDetails: true },
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
    const promises = seasons.map((s: any) => this.tmdb(`tv/${id}/season/${s.season_number}?language=en-US`));
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

  // Keep your existing helper methods for other endpoints
  async trending(type: string) {
    // const cacheKey = `trending/tv/${type}`;
    // const cached = await this.redisService.get(cacheKey);
    // if (cached) return JSON.parse(cached);

    const tv = await this.tmdb(`trending/tv/${type}`);
    // await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async airingToday() {
    const tv = await this.tmdb(`tv/airing_today?language=en-US&page=1`);
    return tv;
  }

  async airingThisWeek() {
    const tv = await this.tmdb(`tv/on_the_air?language=en-US&page=1`);
    return tv;
  }

  async favorites() {
    const tv = await this.tmdb(`tv/top_rated?language=en-US&page=1`);
    return tv;
  }

  async popular() {
    const tv = await this.tmdb(`tv/popular?language=en-US&page=1`);
    return tv;
  }

  async revenue() {
    const tv = await this.tmdb(
      `discover/tv?language=en-US&sort_by=revenue.desc&page=1`,
    );
    return tv;
  }

  async tvByGenres(ids: string, useAnd: boolean = false) {
    const genresParam = useAnd ? ids : ids.replace(/,/g, '|');
    const tv = await this.tmdb(
      `discover/tv?language=en-US&page=1&with_genres=${genresParam}`,
    );
    return tv;
  }
}