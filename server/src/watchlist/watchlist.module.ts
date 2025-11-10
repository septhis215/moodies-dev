import { Module } from '@nestjs/common';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [WatchlistController],
  providers: [WatchlistService, PrismaService],
})
export class WatchlistModule {}
