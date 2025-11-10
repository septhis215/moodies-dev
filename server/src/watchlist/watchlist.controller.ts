import { Body, Controller, Get, Post, Req, UseGuards, Delete, Param, ParseIntPipe } from "@nestjs/common";
import { JwtGuard } from "../auth/guard/jwt.guard";
import { WatchlistService } from "./watchlist.service";

@UseGuards(JwtGuard)
@Controller("watchlist")
export class WatchlistController {
  constructor(private svc: WatchlistService) {}

  @Get()
  getAll(@Req() req) {
    return this.svc.getAll(req.user.id);
  }

  @Post("toggle")
  toggle(@Req() req, @Body() body: { tmdbId: string; type: "movie" | "series" }) {
    return this.svc.toggle(req.user.id, body.tmdbId, body.type);
  }

  @Post("clear")
  clear(@Req() req) {
    return this.svc.clear(req.user.sub);
  }

  @Delete(':type/:id')
  remove(
    @Req() req,
    @Param('type') type: 'movie' | 'tv',                
    @Param('id', ParseIntPipe) id: number,              
  ) {
    return this.svc.removeFromWatchlist(req.user.id, type, id);
  }
}
