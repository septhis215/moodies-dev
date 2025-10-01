import { Module } from '@nestjs/common';
import { TvService } from './tv.service';
import { TvController } from './tv.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MoodsModule } from 'src/routes/moods/moods.module';

@Module({
  imports: [HttpModule, ConfigModule, MoodsModule],
  providers: [TvService],
  controllers: [TvController]
})
export class TvModule {}
