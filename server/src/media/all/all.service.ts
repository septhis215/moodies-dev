import { Injectable, OnModuleInit } from '@nestjs/common';
import { TmdbClientService } from './client/tmdb-client.service';
import { TrendingService } from './trending/trending.service';
import { TrailersService } from './trailers/trailers.service';
import { UpcomingFeedService } from './trailers/upcoming-feed.service';
import { RecommendationsService } from './recommendations/recommendations.service';
import { VideoFeedService } from './feed/video-feed.service';
import { PeopleService } from './people/people.service';
import { SearchService } from './search/search.service';
import { ReviewsService } from './reviews/reviews.service';
import { ImagesService } from './images/images.service';
import { TmdbAll, TmdbPerson, TrendingTerm } from './types/tmdb.types';

export type { TmdbAll, TmdbPerson, TrendingTerm };

@Injectable()
export class AllService implements OnModuleInit {
  constructor(
    private readonly tmdbClient: TmdbClientService,
    private readonly trendingService: TrendingService,
    private readonly trailersService: TrailersService,
    private readonly upcomingFeedService: UpcomingFeedService,
    private readonly recommendationsService: RecommendationsService,
    private readonly videoFeedService: VideoFeedService,
    private readonly peopleService: PeopleService,
    private readonly searchService: SearchService,
    private readonly reviewsService: ReviewsService,
    private readonly imagesService: ImagesService,
  ) {}

  async onModuleInit() {
    await this.tmdbClient.loadGenres();
  }

  // --- Trending & Featured ---
  getFeatured(limit = 30) {
    return this.trendingService.getFeatured(limit);
  }
  getTrending(limit = 30) {
    return this.trendingService.getTrending(limit);
  }
  getKoreaTrending(limit = 30) {
    return this.trendingService.getKoreaTrending(limit);
  }
  getFavorites(userId: string, limit = 30) {
    return this.trendingService.getFavorites(userId, limit);
  }
  trending(type: string) {
    return this.trendingService.trending(type);
  }

  // --- Trailers ---
  getTrailers(limit = 30) {
    return this.trailersService.getTrailers(limit);
  }
  getUpcomingTrailers(limit = 30) {
    return this.trailersService.getUpcomingTrailers(limit);
  }
  getTrailersForItems(items: { type: 'movie' | 'tv'; id: number }[]) {
    return this.trailersService.getTrailersForItems(items);
  }
  getMovieVideos(id: number) {
    return this.trailersService.getMovieVideos(id);
  }
  getTvVideos(id: number) {
    return this.trailersService.getTvVideos(id);
  }

  // --- Upcoming Feed ---
  getUpcomingFeeds(page = 1, limit = 35, viewerId?: string) {
    return this.upcomingFeedService.getUpcomingFeeds(page, limit, viewerId);
  }

  // --- Recommendations ---
  getSmartRecommendations(
    type: 'movie' | 'tv',
    id: number,
    limit = 10,
    minRequired = 3,
  ) {
    return this.recommendationsService.getSmartRecommendations(
      type,
      id,
      limit,
      minRequired,
    );
  }
  getRecommendations(type: 'movie' | 'tv', id: number, limit = 10) {
    return this.recommendationsService.getRecommendations(type, id, limit);
  }
  getItemRecommendations(type: 'movie' | 'tv', id: number, limit: number) {
    return this.recommendationsService.getItemRecommendations(type, id, limit);
  }

  // --- Video Feed ---
  getVideoFeed(
    salt = 0,
    page = 1,
    mediaType?: 'movie' | 'tv',
    limit = 18,
    viewerId?: string,
  ) {
    return this.videoFeedService.getVideoFeed(
      salt,
      page,
      mediaType,
      limit,
      viewerId,
    );
  }

  recordVideoFeedViewed(
    viewerId: string | undefined,
    mediaType: 'movie' | 'tv',
    id: number,
    videoKey?: string,
  ) {
    return this.videoFeedService.recordViewedTrailer(
      viewerId,
      mediaType,
      id,
      videoKey,
    );
  }

  // --- People ---
  getPeople(limit = 30) {
    return this.peopleService.getPeople(limit);
  }

  // --- Search ---
  getSearchSuggestions(query: string, limit = 6) {
    return this.searchService.getSearchSuggestions(query, limit);
  }
  getTrendingSearchTerms() {
    return this.searchService.getTrendingSearchTerms();
  }

  // --- Reviews ---
  getTrendingReviews(limit = 40) {
    return this.reviewsService.getTrendingReviews(limit);
  }

  // --- Images ---
  images(id: number, type: string) {
    return this.imagesService.images(id, type);
  }
}
