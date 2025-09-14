import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly movieService: MoviesService) {}

  @Get('trending/day')
  async getTrendingMoviesDay() {
    return this.movieService.trending('day');
  }

  @Get('trending/week')
  async getTrendingMoviesWeek() {
    return this.movieService.trending('week');
  }

  @Get('premiere')
  async getPremiereMovies() {
    return this.movieService.premieres();
  }

  @Get('favorite')
  async getFavoriteMovies() {
    return this.movieService.favorites();
  }

  @Get('popular')
  async getPopularMovies() {
    return this.movieService.popular();
  }

  @Get('reviews/:id')
  async getSpecificMovieReviews(@Param('id') id: string) {
    return this.movieService.specificReviews(Number(id));
  }

  @Get('revenue')
  async getRevenue() {
    return this.movieService.revenue();
  }

  @Get('genres/:ids')
  async getMoviesByGenres(
    @Param('ids') ids: string,
    @Query('mode') mode: 'and' | 'or' = 'or', // default is OR
  ) {
    return this.movieService.moviesByGenres(ids, mode === 'and');
  }
}
