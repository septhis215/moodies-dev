import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MoodsController } from './moods.controller';
import { MoodsService } from './moods.service';

@Module({
  imports: [ConfigModule],
  controllers: [MoodsController],
  providers: [MoodsService],
  exports: [MoodsService],
})
export class MoodsModule { }
