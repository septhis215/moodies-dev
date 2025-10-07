import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class PeopleService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly httpService: HttpService,
    // private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('TMDB_BASE') ?? 'null tmdb base';
    this.token =
      this.configService.get<string>('TMDB_API_KEY') ?? 'null tmdb api key';
  }

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

    return response.data;
  }

  async trending(type: string) {
    // const cacheKey = `trending/person/${type}`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const data = await this.tmdb(`trending/person/${type}`);
    const person = data.results;

    // await this.redisService.set(cacheKey, JSON.stringify(person), 60);
    return person;
  }

  // Get celebrity details by ID
  async getPersonDetails(id: number) {
    // const cacheKey = `person/${id}/details`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const details = await this.tmdb(
      `person/${id}?append_to_response=images,combined_credits,external_ids,movie_credits,tv_credits,changes,tagged_images`
    );

    // await this.redisService.set(cacheKey, JSON.stringify(details), 300);
    return details;
  }

  // Get celebrity movie credits
  async getMovieCredits(id: number) {
    // const cacheKey = `person/${id}/movie_credits`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const credits = await this.tmdb(`person/${id}/movie_credits`);

    // await this.redisService.set(cacheKey, JSON.stringify(credits), 300);
    return credits;
  }

  // Get celebrity TV credits
  async getTvCredits(id: number) {
    // const cacheKey = `person/${id}/tv_credits`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const credits = await this.tmdb(`person/${id}/tv_credits`);

    // await this.redisService.set(cacheKey, JSON.stringify(credits), 300);
    return credits;
  }

  // Get celebrity images
  async getImages(id: number) {
    // const cacheKey = `person/${id}/images`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const images = await this.tmdb(`person/${id}/images`);

    // await this.redisService.set(cacheKey, JSON.stringify(images), 300);
    return images;
  }

  async getTaggedImages(id: number) {
    const images = await this.tmdb(`person/${id}/tagged_images`);
    return images;
  }

  // Search for people
  async searchPeople(query: string, page: number = 1) {
    const data = await this.tmdb(`search/person?query=${encodeURIComponent(query)}&page=${page}`);
    return data;
  }

  // Get popular people
  async getPopular(page: number = 1) {
    // const cacheKey = `person/popular/${page}`;
    // const cached = await this.redisService.get(cacheKey);

    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const data = await this.tmdb(`person/popular?page=${page}`);

    // await this.redisService.set(cacheKey, JSON.stringify(data), 180);
    return data;
  }
}