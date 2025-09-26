import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MoodsController } from './moods.controller';
import { MoodsService } from './moods.service';
import { Mood } from './entities/mood.entity';
import { MoodLog } from './entities/mood-log.entity';
import { Recommendation } from './entities/recommendation.entity';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ HttpModule,
    ConfigModule,
  ],
  controllers: [MoodsController],
  providers: [MoodsService, TMDBService],
  exports: [MoodsService, TMDBService],
})
export class MoodsModule { }