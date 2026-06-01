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
import { VideoScoringService } from './videos/video-scoring.service';
import { PeopleService } from './people/people.service';
import { SearchService } from './search/search.service';
import { ReviewsService } from './reviews/reviews.service';
import { ImagesService } from './images/images.service';
import { AllController } from './all.controller';

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
        VideoScoringService,
        PeopleService,
        SearchService,
        ReviewsService,
        ImagesService,
    ],
    controllers: [AllController],
    exports: [AllService],
})
export class AllModule {}