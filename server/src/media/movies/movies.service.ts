import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';

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
    this.baseUrl =
      this.configService.get<string>('TMDB_BASE') ?? 'null tmdb base';
    this.token =
      this.configService.get<string>('TMDB_API_KEY') ?? 'null tmdb api key';
  }

  // Return full response.data (raw). Caller decides whether to use .results
  private async tmdb(endpoint: string) {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
      }),
    );

    return response.data; // <-- return full payload
  }

  // Trending with caching
  async trending(type: string) {
    const cacheKey = `trending/movies/${type}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.tmdb(`trending/movie/${type}`);
    const movies = data?.results ?? data; // works if tmdb returned results or array
    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async premieres() {
    const cacheKey = `premiere/movies`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.tmdb(`movie/now_playing?language=en-US&page=1`);
    const movies = data?.results ?? data;
    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async favorites() {
    const cacheKey = `favorite/movies`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.tmdb(`movie/top_rated?language=en-US&page=1`);
    const movies = data?.results ?? data;
    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async popular() {
    const cacheKey = `popular/movies`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.tmdb(`movie/popular?language=en-US&page=1`);
    const movies = data?.results ?? data;
    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async specificReviews(id: number) {
    const cacheKey = `reviews/movies/${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.tmdb(`movie/${id}/reviews?language=en-US&page=1`);
    const reviews = data?.results ?? data;
    await this.redisService.set(cacheKey, JSON.stringify(reviews), 60);
    return reviews;
  }

  async revenue() {
    const cacheKey = `revenue/movies`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.tmdb(
      `discover/movie?language=en-US&sort_by=revenue.desc&page=1`,
    );
    const movies = data?.results ?? data;
    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async moviesByGenres(ids: string, useAnd: boolean = false) {
    const genresParam = useAnd ? ids : ids.replace(/,/g, '|');
    const cacheKey = `movies/genres/${genresParam}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.tmdb(
      `discover/movie?language=en-US&page=1&with_genres=${genresParam}`,
    );
    const movies = data?.results ?? data;
    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  // Specific Movie Details helpers - note these now assume tmdb returns raw payload
  async movieTrailer(id: number) {
    const data = await this.tmdb(`movie/${id}/videos?language=en-US`);
    const videos = data?.results ?? data;
    const filtered = (videos || []).find(
      (video: any) => video.type === 'Trailer' && video.site === 'YouTube'
    );
    return filtered ?? null;
  }

  async movieInfo(id: number) {
    const info = await this.tmdb(`movie/${id}?language=en-US`);
    return info;
  }

  async movieCredits(id: number) {
    const credits = await this.tmdb(`movie/${id}/credits?language=en-US`);
    return credits;
  }

  async movieReviews(id: number) {
    const data = await this.tmdb(`movie/${id}/reviews?language=en-US&page=1`);
    const reviews = data?.results ?? data;
    return reviews;
  }

  async movieProviders(id: number) {
    const providers = await this.tmdb(`movie/${id}/watch/providers`);
    return providers;
  }

  async similarMovies(id: number) {
    const data = await this.tmdb(`movie/${id}/similar?language=en-US&page=1`);
    const movies = data?.results ?? data;
    return movies;
  }

  async movieDetails(id: number) {
    const cacheKey = `movie/details/${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        this.logger.warn('Failed to parse cached movie details, refetching', err);
      }
    }

    const [
      info,
      credits,
      videosRaw,
      providers,
      reviewsRaw,
      similarRaw,
    ] = await Promise.all([
      this.movieInfo(id),
      this.movieCredits(id),
      this.movieTrailer(id),
      this.movieProviders(id),
      this.movieReviews(id),
      this.similarMovies(id),
    ]);

    const trailer = (videosRaw?.results ?? []).find(
      (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
    ) ?? null;

    const reviews = reviewsRaw?.results ?? reviewsRaw ?? [];
    const similar = similarRaw?.results ?? similarRaw ?? [];

    const payload = {
      info,
      credits,
      trailer,
      providers,
      reviews,
      similar,
    };

    // cache for 5 minutes (300s) or whatever TTL suits you
    await this.redisService.set(cacheKey, JSON.stringify(payload), 300);

    return payload;
  }
}
