import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TvService } from './tv.service';
import { TvTmdbClientService } from './client/tv-tmdb-client.service';
import { TvContentFilterService } from './filters/tv-content-filter.service';
import { TvRecommendationsService } from './recommendations/tv-recommendations.service';
import { TvCatalogService } from './catalog/tv-catalog.service';
import { TvTrailersService } from './trailers/tv-trailers.service';
import { TvDetailsService } from './details/tv-details.service';
import { TvMediaService } from './media/tv-media.service';
import { TvNewReleasesService } from './new-releases/tv-new-releases.service';
import { TvController } from './tv.controller';
import { MoodsModule } from 'src/routes/moods/moods.module';

@Module({
  imports: [ConfigModule, MoodsModule],
  providers: [
    TvService,
    TvTmdbClientService,
    TvContentFilterService,
    TvRecommendationsService,
    TvCatalogService,
    TvTrailersService,
    TvDetailsService,
    TvMediaService,
    TvNewReleasesService,
  ],
  controllers: [TvController],
  exports: [TvService],
})
export class TvModule { }