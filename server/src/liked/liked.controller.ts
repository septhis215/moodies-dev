import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { LikedService } from './liked.service';

@UseGuards(JwtGuard)
@Controller('liked')
export class LikedController {
  constructor(private svc: LikedService) {}

  @Get()
  getAll(@Req() req) {
    return this.svc.getAll(req.user.id);
  }

  @Post('toggle')
  toggle(
    @Req() req,
    @Body() body: { tmdbId: string; type: 'movie' | 'series' },
  ) {
    return this.svc.toggle(req.user.id, body.tmdbId, body.type);
  }

  @Delete(':type/:id')
  remove(
    @Req() req,
    @Param('type') type: 'movie' | 'tv',
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.remove(req.user.id, type, id);
  }
}
