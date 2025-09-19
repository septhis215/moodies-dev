import { Controller, Get, Param, Query } from '@nestjs/common';
import { TvService } from './tv.service';

@Controller('tv')
export class TvController {
  constructor(private readonly tvService: TvService) {}

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

  @Get('reviews/:id')
  async getSpecificTVReviews(@Param('id') id: string) {
    return this.tvService.specificReviews(Number(id));
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
}
