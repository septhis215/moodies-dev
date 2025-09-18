import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly movieService: MoviesService) { }

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


  // Specific Movie Details
  @Get('trailer/:id')
  async getMovieTrailer(@Param('id') id: string) {
    return this.movieService.movieTrailer(Number(id));
  }

  @Get('info/:id')
  async getMovieInfo(@Param('id') id: string) {
    return this.movieService.movieInfo(Number(id));
  }

  @Get('credits/:id')
  async getMovieCredits(@Param('id') id: string) {
    return this.movieService.movieCredits(Number(id));
  }

  // use the same reviews/:id endpoint from above

  @Get('providers/:id')
  async getMovieProviders(@Param('id') id: string) {
    return this.movieService.movieProviders(Number(id));
  }

  @Get('similar/:id')
  async getSimilarMovies(@Param('id') id: string) {
    return this.movieService.similarMovies(Number(id));
  }
}
