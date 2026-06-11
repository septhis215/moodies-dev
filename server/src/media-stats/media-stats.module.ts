import { Module } from '@nestjs/common';
import { MediaStatsController } from './media-stats.controller';
import { MediaStatsService } from './media-stats.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MediaStatsController],
  providers: [MediaStatsService, PrismaService],
  exports: [MediaStatsService],
})
export class MediaStatsModule {}
