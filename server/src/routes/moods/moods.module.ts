import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MoodsController } from './moods.controller';
import { MoodsService } from './moods.service';
import { AllModule } from 'src/media/all/all.module';
import { MoodNightPreviewService } from './mood-night-preview.service';

@Module({
  imports: [ConfigModule, AllModule],
  controllers: [MoodsController],
  providers: [MoodsService, MoodNightPreviewService],
  exports: [MoodsService, MoodNightPreviewService],
})
export class MoodsModule { }
