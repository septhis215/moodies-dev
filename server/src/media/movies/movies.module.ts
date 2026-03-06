import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { MoviesService } from './movies.service';
import { MovieTmdbClientService } from './client/movie-tmdb-client.service';
import { MovieContentFilterService } from './filters/movie-content-filter.service';
import { MovieRecommendationsService } from './recommendations/movie-recommendations.service';
import { MovieCatalogService } from './catalog/movie-catalog.service';
import { MovieTrailersService } from './trailers/movie-trailers.service';
import { MovieDetailsService } from './details/movie-details.service';
import { MovieMediaService } from './media/movie-media.service';
import { MoviesController } from './movies.controller';

@Module({
    imports: [HttpModule, ConfigModule],
    providers: [
        MoviesService,
        MovieTmdbClientService,
        MovieContentFilterService,
        MovieRecommendationsService,
        MovieCatalogService,
        MovieTrailersService,
        MovieDetailsService,
        MovieMediaService,
    ],
    controllers: [MoviesController],
    exports: [MoviesService],
})
export class MoviesModule {}