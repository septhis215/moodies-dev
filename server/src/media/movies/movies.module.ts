import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [MoviesService],
  controllers: [MoviesController],
  exports: [MoviesService],
})
export class MoviesModule {}
