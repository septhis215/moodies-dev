import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "../auth/guard/jwt.guard";
import { WatchlistService } from "./watchlist.service";

@UseGuards(JwtGuard)
@Controller("watchlist")
export class WatchlistController {
  constructor(private svc: WatchlistService) {}

  @Get()
  getAll(@Req() req) {
    return this.svc.getAll(req.user.sub);
  }

  @Post("toggle")
  toggle(@Req() req, @Body() body: { tmdbId: string; type: "movie" | "series" }) {
    return this.svc.toggle(req.user.sub, body.tmdbId, body.type);
  }

  @Post("clear")
  clear(@Req() req) {
    return this.svc.clear(req.user.sub);
  }
}
