import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class MoviesService {
  private readonly baseUrl: string;
  private readonly token: string;

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

  private async tmdb(endpoint: string) {
    const url = `${this.baseUrl}${endpoint}`;

    // test getting first value
    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
      }),
    );

    return response.data.results;
  }

  async trending(type: string) {
    const cacheKey = `trending/movies/${type}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(`trending/movie/${type}`);

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60); // <number> hour life duration
    // console.log('From Redis Movies: ', movies);
    return movies;
  }

  async premieres() {
    const cacheKey = `premiere/movies`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(`movie/now_playing?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async favorites() {
    const cacheKey = `favorite/movies`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(`movie/top_rated?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async popular() {
    const cacheKey = `popular/movies`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(`movie/popular?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async specificReviews(id: number) {
    const cacheKey = `reviews/movies/${id}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(`movie/${id}/reviews?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async revenue() {
    const cacheKey = `revenue/movies`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(
      `discover/movie?language=en-US&sort_by=revenue.desc&page=1`,
    );

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }

  async moviesByGenres(ids: string, useAnd: boolean = false) {
    const genresParam = useAnd ? ids : ids.replace(/,/g, '|'); // replace commas with pipes (,) => (|)
    const cacheKey = `movies/genres/${genresParam}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const movies = await this.tmdb(
      `discover/movie?language=en-US&page=1&with_genres=${genresParam}`,
    );

    await this.redisService.set(cacheKey, JSON.stringify(movies), 60);
    return movies;
  }


  // Specific Movie Details
  async movieTrailer(id: number) {
    const movies = await this.tmdb(`movie/${id}/videos?language=en-US`);
    const filtered = movies.results.find(
      (video: any) => video.type === 'Trailer' && video.site === 'YouTube'
    )
    return filtered;
  }

  async movieInfo(id: number) {
    const movie = await this.tmdb(`movie/${id}?language=en-US`);
    return movie;
  }

  async movieCredits(id: number) {
    const credits = await this.tmdb(`movie/${id}/credits?language=en-US`);
    return credits;
  }

  async movieReviews(id: number) {
    const reviews = await this.tmdb(`movie/${id}/reviews?language=en-US`);
    return reviews;
  }

  // where movies can be streamed or premiered
  async movieProviders(id: number) {
    const providers = await this.tmdb(`movie/${id}/watch/providers`);
    return providers;
  }

  async similarMovies(id: number) {
    const movies = await this.tmdb(`movie/${id}/similar?language=en-US&page=1`);
    return movies;
  }
}
