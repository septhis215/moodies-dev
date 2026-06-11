import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AllService } from './all.service';
import { TmdbClientService } from './client/tmdb-client.service';
import { ContentFilterService } from './filters/content-filter.service';
import { RecommendationsService } from './recommendations/recommendations.service';
import { TrendingService } from './trending/trending.service';
import { TrailersService } from './trailers/trailers.service';
import { UpcomingFeedService } from './trailers/upcoming-feed.service';
import { VideoFeedService } from './feed/video-feed.service';
import { FeedUtilsService } from './feed/feed-utils.service';
import { VideoScoringService } from './videos/video-scoring.service';
import { PeopleService } from './people/people.service';
import { SearchService } from './search/search.service';
import { ReviewsService } from './reviews/reviews.service';
import { ImagesService } from './images/images.service';
import { AllController } from './all.controller';
import { TvTmdbClientService } from '../tv/client/tv-tmdb-client.service';
import { TvRecommendationsService } from '../tv/recommendations/tv-recommendations.service';

@Module({
  imports: [ConfigModule],
  providers: [
    AllService,
    TmdbClientService,
    ContentFilterService,
    RecommendationsService,
    TrendingService,
    TrailersService,
    UpcomingFeedService,
    VideoFeedService,
    FeedUtilsService,
    VideoScoringService,
    PeopleService,
    SearchService,
    ReviewsService,
    ImagesService,
    TvTmdbClientService,
    TvRecommendationsService,
  ],
  controllers: [AllController],
  exports: [AllService],
})
export class AllModule {}
