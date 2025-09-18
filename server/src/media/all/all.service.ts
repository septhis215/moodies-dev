import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AllService {
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
    const cacheKey = `trending/all/${type}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const all = await this.tmdb(`trending/all/${type}`);

    await this.redisService.set(cacheKey, JSON.stringify(all), 60);
    return all;
  }
}
