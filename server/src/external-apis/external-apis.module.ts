import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TMDBService } from './services/tmdb.service';
import { TmdbRateLimiterService } from './services/tmdb-rate-limiter.service';

@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [TMDBService, TmdbRateLimiterService],
  exports: [TMDBService, TmdbRateLimiterService],
})
export class ExternalApisModule {}
