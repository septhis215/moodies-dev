import { Controller, Get, HttpException, Param, Query } from '@nestjs/common';
import { TvService } from './tv.service';

@Controller('tv')
export class TvController {
  constructor(private readonly tvService: TvService) { }

  @Get('trending/day')
  async getTrendingTVDay() {
    return this.tvService.trending('day');
  }

  @Get('trending/week')
  async getTrendingTVWeek() {
    return this.tvService.trending('week');
  }

  @Get('airing/today')
  async getAiringToday() {
    return this.tvService.airingToday();
  }

  @Get('airing/week')
  async getAiringThisWeek() {
    return this.tvService.airingThisWeek();
  }

  @Get('favorite')
  async getFavoriteTV() {
    return this.tvService.favorites();
  }

  @Get('popular')
  async getPopularTV() {
    return this.tvService.popular();
  }

  @Get('revenue')
  async getRevenue() {
    return this.tvService.revenue();
  }

  @Get('genres/:ids')
  async getTVByGenres(
    @Param('ids') ids: string,
    @Query('mode') mode: 'and' | 'or' = 'or', // default is OR
  ) {
    return this.tvService.tvByGenres(ids, mode === 'and');
  }

  // Main TV details endpoint - matches movies approach
  @Get('details/:id')
  async getTVDetails(@Param('id') id: string) {
    return this.tvService.tvDetails(Number(id));
  }

  @Get('seasons/episodes/:id')
  async getTvSeasonsEpisodes(@Param('id') id: string) {
    return this.tvService.fetchSeasonsWithEpisodes(Number(id))
  }
}