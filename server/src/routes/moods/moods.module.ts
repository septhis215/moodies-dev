import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MoodsController } from './moods.controller';
import { MoodsService } from './moods.service';
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