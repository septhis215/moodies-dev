import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';

type ContentType = 'movie' | 'tv';

@Injectable()
export class MoviesService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
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

  // Try movie then tv if preferredType not provided
  async detectContentType(id: number): Promise<ContentType | null> {
    const movie = await this.tmdb(`movie/${id}?language=en-US`);
    if (movie) return 'movie';
    const tv = await this.tmdb(`tv/${id}?language=en-US`);
    if (tv) return 'tv';
    return null;
  }

  // fetch info for movie or tv
  private async fetchInfo(id: number, type: ContentType) {
    return await this.tmdb(`${type}/${id}?language=en-US`);
  }

  private async fetchCredits(id: number, type: ContentType) {
    return await this.tmdb(`${type}/${id}/credits?language=en-US`);
  }

  private async fetchVideos(id: number, type: ContentType) {
    return await this.tmdb(`${type}/${id}/videos?language=en-US`);
  }

  private async fetchProviders(id: number, type: ContentType) {
    return await this.tmdb(`${type}/${id}/watch/providers`);
  }

  private async fetchReviews(id: number, type: ContentType) {
    return await this.tmdb(`${type}/${id}/reviews?language=en-US&page=1`);
  }

  private async fetchSimilar(id: number, type: ContentType) {
    return await this.tmdb(`${type}/${id}/similar?language=en-US&page=1`);
  }

  // Public: prepared, normalized details payload
  async movieDetails(id: number, preferredType?: ContentType) {
    // allow frontend to force type via query param if it already knows it
    const cacheKey = `movie/details/${id}/${preferredType ?? 'auto'}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        this.logger.warn('Failed to parse cached movie details, will refetch', err);
      }
    }

    const detectedType =
      preferredType ?? (await this.detectContentType(id)) ?? 'movie';

    // fetch in parallel from the appropriate endpoints
    const [
      infoRaw,
      creditsRaw,
      videosRaw,
      providersRaw,
      reviewsRaw,
      similarRaw,
    ] = await Promise.all([
      this.fetchInfo(id, detectedType),
      this.fetchCredits(id, detectedType),
      this.fetchVideos(id, detectedType),
      this.fetchProviders(id, detectedType),
      this.fetchReviews(id, detectedType),
      this.fetchSimilar(id, detectedType),
    ]);

    // build trailer if available
    const videos = videosRaw?.results ?? videosRaw ?? [];
    const trailer =
      (videos || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ??
      null;

    // normalise runtime
    const runtime =
      infoRaw?.runtime ??
      // tv uses episode_run_time as array of minutes
      (Array.isArray(infoRaw?.episode_run_time)
        ? infoRaw.episode_run_time[0] ?? 0
        : infoRaw?.episode_run_time ?? 0) ??
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
      status: infoRaw?.status ?? (infoRaw?.in_production ? 'In Production' : 'Released'),
      tagline: infoRaw?.tagline ?? null,
      homepage: infoRaw?.homepage ?? null,
      poster_path: infoRaw?.poster_path ?? null,
      backdrop_path: infoRaw?.backdrop_path ?? null,
      adult: infoRaw?.adult ?? false,
      created_by: infoRaw?.created_by ?? null,
      content_type: detectedType, // explicitly tell frontend the type
      director,
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
      },
    };

    // cache for 5 minutes
    await this.redisService.set(cacheKey, JSON.stringify(payload), 300);

    return payload;
  }

  // keep your other helper methods if needed
}
