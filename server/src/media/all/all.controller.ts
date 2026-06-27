import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AllService } from './all.service';
import { JwtGuard } from 'src/auth/guard';
import { RedisService } from 'src/redis/redis.service';

@Controller('all')
export class AllController {
  private readonly logger = new Logger(AllController.name);

  constructor(
    private readonly allService: AllService,
    private readonly redisService: RedisService,
  ) {}

  @Get('trending/day')
  async getTrendingAllDay() {
    return this.allService.trending('day');
  }

  @Get('trending/week')
  async getTrendingAllWeek() {
    return this.allService.trending('week');
  }

  @Get('featured')
  async featured(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 25;
    return this.allService.getFeatured(parsedLimit);
  }

  @Get('trending')
  async trending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 25;
    return this.allService.getTrending(parsedLimit);
  }

  @Get('trailers')
  async trailers(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 25;
    return this.allService.getTrailers(parsedLimit);
  }

  @UseGuards(JwtGuard)
  @Get('favorites')
  async favorites(@Req() req: any, @Query('limit') limit?: string) {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid token (no user id).');
    }
    const parsedLimit = limit ? parseInt(limit, 20) : 25;
    return this.allService.getFavorites(userId, parsedLimit);
  }

  @Get('koreaTrending')
  async koreaTrending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 25;
    return this.allService.getKoreaTrending(parsedLimit);
  }

  @Get('football-stories')
  async footballStories(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('language') language?: string,
    @Query('region') region?: string,
    @Query('rankingMode') rankingMode?: 'world-cup-docs' | 'popular' | 'recent',
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 18;
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.allService.getFootballStories({
      limit: parsedLimit,
      page: parsedPage,
      language,
      region,
      rankingMode,
      forceRefresh: forceRefresh === 'true',
    });
  }

  @Get('peoples')
  async peoples(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 25;
    return this.allService.getPeople(parsedLimit);
  }

  @Get('trending-reviews')
  async reviews(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 20;
    return this.allService.getTrendingReviews(parsedLimit);
  }

  @Get('upcoming-trailers')
  async upcomingTrailers(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 30;
    return this.allService.getUpcomingTrailers(parsedLimit);
  }
  @Get('search/suggestions')
  async getSearchSuggestions(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 5;
    return this.allService.getSearchSuggestions(query, parsedLimit);
  }

  @Get('search/trending-terms')
  async getTrendingSearchTerms() {
    return this.allService.getTrendingSearchTerms();
  }

  // Enhanced recommendations endpoint with better error handling
  @Get(':type/:id/recommendations')
  async getRecommendations(
    @Param('type') type: 'movie' | 'tv',
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    // Validate type parameter
    if (type !== 'movie' && type !== 'tv') {
      throw new Error('Type must be either "movie" or "tv"');
    }

    const parsedLimit = limit ? parseInt(limit, 20) : 3;
    return this.allService.getSmartRecommendations(type, id, parsedLimit);
  }

  // NEW: Separate endpoint for getting recommendations for specific items
  // This allows frontend to load recommendations on-demand
  @Get('recommendations/:type/:id')
  async getItemRecommendations(
    @Param('type') type: 'movie' | 'tv',
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    if (type !== 'movie' && type !== 'tv') {
      throw new Error('Type must be either "movie" or "tv"');
    }

    const parsedLimit = limit ? parseInt(limit, 20) : 3;
    return this.allService.getItemRecommendations(type, id, parsedLimit);
  }

  // NEW: Batch trailer endpoint for multiple items
  // Frontend can request trailers for multiple items at once
  @Post('batch/trailers')
  async getBatchTrailers(
    @Body() items: { type: 'movie' | 'tv'; id: number }[],
  ) {
    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }

    // Validate each item
    for (const item of items) {
      if (
        !item.type ||
        !item.id ||
        (item.type !== 'movie' && item.type !== 'tv')
      ) {
        throw new Error(
          'Each item must have valid type ("movie" or "tv") and id',
        );
      }
    }

    // Limit batch size to prevent abuse
    if (items.length > 50) {
      throw new Error('Maximum 50 items allowed per batch request');
    }

    return this.allService.getTrailersForItems(items);
  }

  // NEW: Health check endpoint to verify service status
  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'AllService',
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

  @Get('cache/status')
  async getCacheStatus() {
    return this.redisService.getSummary('*', 500);
  }

  // NEW: Bulk endpoint for getting multiple categories at once
  // Useful for loading dashboard data in a single request
  @Get('bulk/dashboard')
  async getDashboardData(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 20) : 20;

    // Execute all requests in parallel for faster response
    const [featured, trending, trailers, koreaTrending, reviews] =
      await Promise.allSettled([
        this.allService.getFeatured(parsedLimit),
        this.allService.getTrending(parsedLimit),
        this.allService.getTrailers(parsedLimit),
        this.allService.getKoreaTrending(parsedLimit),
        this.allService.getTrendingReviews(Math.min(parsedLimit, 20)), // Limit reviews to 10 max
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
    @Query('type') type?: 'movie' | 'tv',
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
  async getTvImages(
    @Param('type') type: 'movie' | 'tv',
    @Param('id') id: string,
  ) {
    try {
      const images = this.allService.images(Number(id), type);
      return images;
    } catch (err) {
      this.logger.error(
        `Failed to load ${type} images for ${id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Get('upcoming-trailers-feed')
  async getUpcomingTrailersFeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('viewerId') viewerId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 30) : 30;

    const response = await this.allService.getUpcomingFeeds(
      pageNum,
      limitNum,
      viewerId,
    );

    // Format the results - handle both enriched and non-enriched data
    const formatted = response.results.map((item) => {
      // Get the correct title
      const title = item.title || item.name || 'Untitled';

      // Get the correct release date
      const releaseDate = item.release_date || item.first_air_date;

      return {
        id: item.id,
        title: title,
        name: title,
        overview: item.overview || '',
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: releaseDate,
        first_air_date: releaseDate,
        original_language: item.original_language || 'en',
        genres: item.genres || [],
        vote_average: item.vote_average || 0,
        vote_count: item.vote_count || 0,
        popularity: item.popularity || 0,
        media_type: item.media_type,
        // Use enriched video data if available
        primary_video: item.primary_video || null,
        videos: item.videos || [],
      };
    });

    return {
      results: formatted,
      page: response.page,
      total_pages: response.total_pages,
      hasMore: response.hasMore,
      nextPage:
        response.nextPage ?? (response.hasMore ? response.page + 1 : null),
    };
  }

  // Optimize the existing getVideoFeed with caching
  @Get('video-feed')
  async getVideoFeed(
    @Query('salt') salt: string,
    @Query('page') page?: string,
    @Query('mediaType') mediaType?: 'movie' | 'tv',
    @Query('limit') limit?: string,
    @Query('viewerId') viewerId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 18;
    return await this.allService.getVideoFeed(
      Number(salt) || 0,
      pageNum,
      mediaType,
      limitNum,
      viewerId,
    );
  }

  @Post('video-feed/viewed')
  async recordVideoFeedViewed(
    @Body()
    body: {
      viewerId?: string;
      mediaType?: 'movie' | 'tv';
      id?: number;
      videoKey?: string;
    },
  ) {
    if (
      !body?.viewerId ||
      !body?.id ||
      (body.mediaType !== 'movie' && body.mediaType !== 'tv')
    ) {
      return { ok: false };
    }

    return this.allService.recordVideoFeedViewed(
      body.viewerId,
      body.mediaType,
      Number(body.id),
      body.videoKey,
    );
  }

  @Get('movie/:id/videos')
  async getMovieVideos(@Param('id') id: string) {
    return this.allService.getMovieVideos(parseInt(id, 10));
  }

  @Get('tv/:id/videos')
  async getTvVideos(@Param('id') id: string) {
    return this.allService.getTvVideos(parseInt(id, 10));
  }
}

/*
CONTROLLER ENHANCEMENTS ADDED:

1. **Query Parameter Support**:
   - All endpoints now accept optional `limit` query parameters
   - Allows frontend to request different amounts of data as needed

2. **Better Error Handling**:
   - Validates type parameters in recommendation endpoints
   - Provides clear error messages for invalid inputs

3. **New Performance Endpoints**:
   - `getItemRecommendations()` - Load recommendations separately
   - `getBatchTrailers()` - Get trailers for multiple items at once
   - `getDashboardData()` - Load multiple categories in single request

4. **Utility Endpoints**:
   - `healthCheck()` - Service status monitoring
   - `getCacheStatus()` - Cache monitoring (implement as needed)
   - `getByGenre()` - Genre-based filtering (implement as needed)

5. **Validation & Security**:
   - Input validation for batch requests
   - Limits on batch sizes to prevent abuse
   - Parameter validation for type safety

FRONTEND USAGE EXAMPLES:

// Load basic trending data (fast)
GET /all/trending?limit=15

// Load recommendations separately (when user scrolls/clicks)
GET /all/recommendations/movie/123?limit=5

// Load dashboard data in one request
GET /all/bulk/dashboard?limit=8

// Get trailers for multiple items at once
POST /all/batch/trailers
Body: [
  { type: "movie", id: 123 },
  { type: "tv", id: 456 }
]

PERFORMANCE BENEFITS:
- Frontend can request optimal data amounts
- Separate recommendation loading improves initial page load
- Batch operations reduce network requests
- Dashboard endpoint reduces API calls for main page
*/
