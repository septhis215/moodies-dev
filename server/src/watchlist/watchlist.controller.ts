import { Body, Controller, Get, Post, Req, UseGuards, Delete, Param, ParseIntPipe } from "@nestjs/common";
import { JwtGuard } from "../auth/guard/jwt.guard";
import { WatchlistService } from "./watchlist.service";
import { LibraryToggleDto } from '../common/dto/library-toggle.dto';

@UseGuards(JwtGuard)
@Controller("watchlist")
export class WatchlistController {
  constructor(private svc: WatchlistService) {}

  @Get()
  getAll(@Req() req: { user: { id: string } }) {
    return this.svc.getAll(req.user.id);
  }

  @Post("toggle")
  toggle(@Req() req: { user: { id: string } }, @Body() body: LibraryToggleDto) {
    return this.svc.toggle(req.user.id, body.tmdbId, body.type, body.active);
  }

  @Post("clear")
  clear(@Req() req: { user: { id: string } }) {
    return this.svc.clear(req.user.id);
  }

  @Delete(':type/:id')
  remove(
    @Req() req: { user: { id: string } },
    @Param('type') type: 'movie' | 'tv',                
    @Param('id', ParseIntPipe) id: number,              
  ) {
    return this.svc.removeFromWatchlist(req.user.id, type, id);
  }
}
