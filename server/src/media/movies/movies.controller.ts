import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly movieService: MoviesService) { }

  @Get('details/:id')
  async details(@Param('id') id: string, @Query('type') type: 'movie') {
    const payload = await this.movieService.movieDetails(
      Number(id),
      type as any,
    );
    return payload;
  }

  @Get('trending')
  async trending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getTrending(parsedLimit);
  }

  @Get('featured')
  async featured(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getFeatured(parsedLimit);
  }

  @Get('trailers')
  async trailers(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getTrailers(parsedLimit);
  }

  @Get('favorites')
  async favorites(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getFavorites(parsedLimit);
  }

  @Get('koreaTrending')
  async koreaTrending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getKoreaTrending(parsedLimit);
  }

  @Get('trending-reviews')
  async reviews(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.movieService.getTrendingReviews(parsedLimit);
  }

  @Get('upcoming-trailers')
  async upcomingTrailers(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    return this.movieService.getUpcomingTrailers(parsedLimit);
  }

  // Enhanced recommendations endpoint with better error handling
  @Get(':type/:id/recommendations')
  async getRecommendations(
    @Param('type') type: 'movie',
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    // Validate type parameter
    if (type !== 'movie') {
      throw new Error('Type must be either "movie"');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 3;
    return this.movieService.getSmartRecommendationsMovie(id, parsedLimit);
  }

  // NEW: Separate endpoint for getting recommendations for specific items
  // This allows frontend to load recommendations on-demand
  @Get('recommendations/:type/:id')
  async getItemRecommendations(
    @Param('type') type: 'movie',
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    if (type !== 'movie') {
      throw new Error('Type must be either "movie"');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 3;
    return this.movieService.getItemRecommendations(type, id, parsedLimit);
  }

  // NEW: Batch trailer endpoint for multiple items
  // Frontend can request trailers for multiple items at once
  @Post('batch/trailers')
  async getBatchTrailers(@Body() items: { type: 'movie'; id: number }[]) {
    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }

    // Validate each item
    for (const item of items) {
      if (!item.type || !item.id || item.type !== 'movie') {
        throw new Error('Each item must have valid type ("movie") and id');
      }
    }

    // Limit batch size to prevent abuse
    if (items.length > 50) {
      throw new Error('Maximum 50 items allowed per batch request');
    }

    return this.movieService.getTrailersForItems(items);
  }

  // NEW: Health check endpoint to verify service status
  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'movieService',
      endpoints: [
        'featured',
        'trending',
        'trailers',
        'favorites',
        'koreaTrending',
        'peoples',
        'trending-reviews',
        'upcoming-trailers',
        'recommendations',
      ],
    };
  }

  // NEW: Cache status endpoint (useful for monitoring)
  @Get('cache/status')
  async getCacheStatus() {
    // This would require adding cache status methods to your service
    return {
      message:
        'Cache status endpoint - implement cache metrics in service if needed',
      timestamp: new Date().toISOString(),
    };
  }

  // NEW: Bulk endpoint for getting multiple categories at once
  // Useful for loading dashboard data in a single request
  @Get('bulk/dashboard')
  async getDashboardData(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    // Execute all requests in parallel for faster response
    const [featured, trending, trailers, koreaTrending, reviews] =
      await Promise.allSettled([
        this.movieService.getFeatured(parsedLimit),
        this.movieService.getTrending(parsedLimit),
        this.movieService.getTrailers(parsedLimit),
        this.movieService.getKoreaTrending(parsedLimit),
        this.movieService.getTrendingReviews(Math.min(parsedLimit, 10)), // Limit reviews to 10 max
      ]);

    return {
      featured: featured.status === 'fulfilled' ? featured.value : [],
      trending: trending.status === 'fulfilled' ? trending.value : [],
      trailers: trailers.status === 'fulfilled' ? trailers.value : [],
      koreaTrending:
        koreaTrending.status === 'fulfilled' ? koreaTrending.value : [],
      reviews: reviews.status === 'fulfilled' ? reviews.value : [],
      timestamp: new Date().toISOString(),
    };
  }

  // NEW: Search-like endpoint for getting items by genre
  @Get('genre/:genreId')
  async getByGenre(
    @Param('genreId', ParseIntPipe) genreId: number,
    @Query('type') type?: 'movie',
    @Query('limit') limit?: string,
  ) {
    // This would require implementing genre-based filtering in your service
    return {
      message:
        'Genre-based filtering endpoint - implement in service if needed',
      genreId,
      type,
      limit: limit ? parseInt(limit, 10) : 25,
    };
  }

  @Get('images/:type/:id')
  async getMovieImages(@Param('type') type: 'movie', @Param('id') id: string) {
    try {
      const images = this.movieService.images(Number(id), type);
      return images;
    } catch (err) {
      console.log(err);
    }
  }
  @Get('action-movies')
  async actionMovies(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getActionMovies(parsedLimit);
  }

  @Get('animated-movies')
  async animatedMovies(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getAnimatedMovies(parsedLimit);
  }

  @Get('documentary-movies')
  async documentaryMovies(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getDocumentaryMovies(parsedLimit);
  }

  @Get('award-winners')
  async awardWinners(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getAwardWinners(parsedLimit);
  }

  @Get('indie-movies')
  async indieMovies(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.movieService.getIndieMovies(parsedLimit);
  }
}
