import { Module } from '@nestjs/common';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';
import { RedisModule } from 'src/redis/redis.module';
import { MediaCacheService } from './media/media-cache.service';
import { MediaHttpService } from './media/media-http.service';
import { CelebrityIdentityService } from './media/celebrity-identity.service';
import { TmdbMediaProvider } from './media/tmdb-media.provider';
import { YoutubeMediaProvider } from './media/youtube-media.provider';
import { WikimediaMediaProvider } from './media/wikimedia-media.provider';
import { CelebrityMediaService } from './media/celebrity-media.service';
import { OpenverseMediaProvider } from './media/openverse-media.provider';
import { PeopleRecommendationsService } from './people-recommendations.service';

@Module({
  imports: [RedisModule],
  providers: [
    PeopleService,
    MediaCacheService,
    MediaHttpService,
    CelebrityIdentityService,
    TmdbMediaProvider,
    YoutubeMediaProvider,
    WikimediaMediaProvider,
    OpenverseMediaProvider,
    CelebrityMediaService,
    PeopleRecommendationsService,
  ],
  controllers: [PeopleController],
})
export class PeopleModule {}
