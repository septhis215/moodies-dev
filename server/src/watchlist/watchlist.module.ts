import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WatchlistService } from "./watchlist.service";
import { WatchlistController } from "./watchlist.controller";

@Module({
  imports: [PrismaModule],
  providers: [WatchlistService],
  controllers: [WatchlistController],
})
export class WatchlistModule {}
