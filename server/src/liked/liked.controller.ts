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
import { LibraryToggleDto } from '../common/dto/library-toggle.dto';

@UseGuards(JwtGuard)
@Controller('liked')
export class LikedController {
  constructor(private svc: LikedService) {}

  @Get()
  getAll(@Req() req: { user: { id: string } }) {
    return this.svc.getAll(req.user.id);
  }

  @Post('toggle')
  toggle(
    @Req() req: { user: { id: string } },
    @Body() body: LibraryToggleDto,
  ) {
    return this.svc.toggle(req.user.id, body.tmdbId, body.type, body.active);
  }

  @Delete(':type/:id')
  remove(
    @Req() req: { user: { id: string } },
    @Param('type') type: 'movie' | 'tv',
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.remove(req.user.id, type, id);
  }
}
