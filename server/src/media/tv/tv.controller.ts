import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { TvService } from './tv.service';

@Controller('tv')
export class TvController {
  constructor(private readonly tvService: TvService) { }

  // Main TV details endpoint - matches movies approach
  @Get('details/:id')
  async details(@Param('id') id: string, @Query('type') type: 'tv') {
    const payload = await this.tvService.tvDetails(Number(id), type as any);
    return payload;
  }

  @Get('seasons/episodes/:id')
  async getTvSeasonsEpisodes(@Param('id') id: string) {
    return this.tvService.fetchSeasonsWithEpisodes(Number(id));
  }

  @Get('airing/today')
  async getAiringToday(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.airingToday(parsedLimit);
  }

  @Get('airing/week')
  async getAiringThisWeek(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.airingThisWeek(parsedLimit);
  }

  @Get('revenue')
  async revenue(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.getRevenue(parsedLimit);
  }

  @Get('trending')
  async trending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.getTrending(parsedLimit);
  }

  @Get('featured')
  async featured(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.getFeatured(parsedLimit);
  }

  @Get('trailers')
  async trailers(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.getTrailers(parsedLimit);
  }

  @Get('favorites')
  async favorites(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.getFavorites(parsedLimit);
  }

  @Get('koreaTrending')
  async koreaTrending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.tvService.getKoreaTrending(parsedLimit);
  }

  @Get('trending-reviews')
  async reviews(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.tvService.getTrendingReviews(parsedLimit);
  }

  @Get('upcoming-trailers')
  async upcomingTrailers(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    return this.tvService.getUpcomingTrailers(parsedLimit);
  }

  // Enhanced recommendations endpoint with better error handling
  @Get(':type/:id/recommendations')
  async getRecommendations(
    @Param('type') type: 'tv',
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    // Validate type parameter
    if (type !== 'tv') {
      throw new Error('Type must be either "tv"');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 5;
    return this.tvService.getSmartRecommendationsTv(id, parsedLimit);
  }

  // NEW: Separate endpoint for getting recommendations for specific items
  // This allows frontend to load recommendations on-demand
  @Get('recommendations/:type/:id')
  async getItemRecommendations(
    @Param('type') type: 'tv',
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    if (type !== 'tv') {
      throw new Error('Type must be either "tv"');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 3;
    return this.tvService.getSmartRecommendationsTv(id, parsedLimit);
  }

  // NEW: Batch trailer endpoint for multiple items
  // Frontend can request trailers for multiple items at once
  @Post('batch/trailers')
  async getBatchTrailers(@Body() items: { type: 'tv'; id: number }[]) {
    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }

    // Validate each item
    for (const item of items) {
      if (!item.type || !item.id || item.type !== 'tv') {
        throw new Error('Each item must have valid type ("tv") and id');
      }
    }

    // Limit batch size to prevent abuse
    if (items.length > 50) {
      throw new Error('Maximum 50 items allowed per batch request');
    }

    return this.tvService.getTrailersForItems(items);
  }

  // NEW: Health check endpoint to verify service status
  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'tvService',
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
        this.tvService.getFeatured(parsedLimit),
        this.tvService.getTrending(parsedLimit),
        this.tvService.getTrailers(parsedLimit),
        this.tvService.getKoreaTrending(parsedLimit),
        this.tvService.getTrendingReviews(Math.min(parsedLimit, 10)), // Limit reviews to 10 max
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
  async getImages(@Param('type') type: 'tv', @Param('id') id: string) {
    try {
      const images = this.tvService.images(Number(id), type);
      return images;
    } catch (err) {
      console.log(err);
    }
  }

  @Get('videos/:type/:id')
  async getVideos(@Param('type') type: 'tv', @Param('id') id: string) {
    try {
      const videos = this.tvService.videos(Number(id), type);
      return videos;
    } catch (err) {
      console.log(err);
    }
  }

  // @Get('genres/:ids')
  // async getTVByGenres(
  //   @Param('ids') ids: string,
  //   @Query('mode') mode: 'and' | 'or' = 'or', // default is OR
  // ) {
  //   return this.tvService.tvByGenres(ids, mode === 'and');
  // }
}
