import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class TvService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly logger = new Logger(TvService.name);

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

    return response.data;
  }

  async trending(type: string) {
    const cacheKey = `trending/tv/${type}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(`trending/tv/${type}`);

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async airingToday() {
    const cacheKey = `airing/tv/today`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(`tv/airing_today?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async airingThisWeek() {
    const cacheKey = `airing/tv/week`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(`tv/on_the_air?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async favorites() {
    const cacheKey = `favorite/tv`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(`tv/top_rated?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async popular() {
    const cacheKey = `popular/tv`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(`tv/popular?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async specificReviews(id: number) {
    const cacheKey = `reviews/tv/${id}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(`tv/${id}/reviews?language=en-US&page=1`);

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async revenue() {
    const cacheKey = `revenue/tv`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(
      `discover/tv?language=en-US&sort_by=revenue.desc&page=1`,
    );

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }

  async tvByGenres(ids: string, useAnd: boolean = false) {
    const genresParam = useAnd ? ids : ids.replace(/,/g, '|'); // replace commas with pipes (,) => (|)
    const cacheKey = `tv/genres/${genresParam}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tv = await this.tmdb(
      `discover/tv?language=en-US&page=1&with_genres=${genresParam}`,
    );

    await this.redisService.set(cacheKey, JSON.stringify(tv), 60);
    return tv;
  }


  // Specific tv Details helpers - note these now assume tmdb returns raw payload
  async tvTrailer(id: number) {
    const data = await this.tmdb(`tv/${id}/videos?language=en-US`);
    const videos = data?.results ?? data;
    const filtered = (videos || []).find(
      (video: any) => video.type === 'Trailer' && video.site === 'YouTube'
    );
    return filtered ?? null;
  }

  async tvInfo(id: number) {
    const info = await this.tmdb(`tv/${id}?language=en-US`);
    return info;
  }

  async tvCredits(id: number) {
    const credits = await this.tmdb(`tv/${id}/credits?language=en-US`);
    return credits;
  }

  async tvReviews(id: number) {
    const data = await this.tmdb(`tv/${id}/reviews?language=en-US&page=1`);
    const reviews = data?.results ?? data;
    return reviews;
  }

  async tvProviders(id: number) {
    const providers = await this.tmdb(`tv/${id}/watch/providers`);
    return providers;
  }

  async similartvs(id: number) {
    const data = await this.tmdb(`tv/${id}/similar?language=en-US&page=1`);
    const tvs = data?.results ?? data;
    return tvs;
  }

  async tvDetails(id: number) {
    const cacheKey = `tv/details/${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        this.logger.warn('Failed to parse cached tv details, refetching', err);
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
      this.tvInfo(id),
      this.tvCredits(id),
      this.tvTrailer(id),
      this.tvProviders(id),
      this.tvReviews(id),
      this.similartvs(id),
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

