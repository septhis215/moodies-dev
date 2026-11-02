import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  Req,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { CookieOriginGuard } from 'src/auth/cookie-origin.guard';
import { AchievementsService } from './achievements.service';
import {
  AchievementActivityDto,
  AchievementNotificationAckDto,
  AchievementQuizCompletionDto,
  WatchedStatusDto,
} from './achievements.dto';

type IdentityRequest = { user: { sub?: string; id?: string } };
@Controller('achievements')
@UseGuards(JwtGuard, CookieOriginGuard)
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}
  private user(req: IdentityRequest) {
    const userId = req.user.sub || req.user.id;
    if (!userId) throw new BadRequestException('Invalid account');
    return userId;
  }
  private type(type: string): 'movie' | 'tv' {
    if (type !== 'movie' && type !== 'tv')
      throw new BadRequestException('Choose a movie or series.');
    return type;
  }
  private id(id: number) {
    if (id < 1 || id > 2147483647)
      throw new BadRequestException('Invalid title.');
    return id;
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() req: IdentityRequest) {
    return this.achievements.getMe(this.user(req));
  }
  @Post('activity')
  activity(@Req() req: IdentityRequest, @Body() body: AchievementActivityDto) {
    return this.achievements.activity(this.user(req), body);
  }
  @Post('quiz-completions')
  quiz(
    @Req() req: IdentityRequest,
    @Body() body: AchievementQuizCompletionDto,
  ) {
    return this.achievements.recordQuiz(
      this.user(req),
      body.answers,
      body.attemptId,
      body.version,
      body.receipt,
      body.timezone,
    );
  }
  @Get('watched/:type/:id')
  @Header('Cache-Control', 'no-store')
  watched(
    @Req() req: IdentityRequest,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.achievements.watched(
      this.user(req),
      this.type(type),
      this.id(id),
    );
  }
  @Put('watched/:type/:id')
  setWatched(
    @Req() req: IdentityRequest,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: WatchedStatusDto,
  ) {
    return this.achievements.setWatched(
      this.user(req),
      this.type(type),
      this.id(id),
      body.active,
    );
  }
  @Post('notifications/claim')
  @Header('Cache-Control', 'no-store')
  notifications(@Req() req: IdentityRequest) {
    return this.achievements.claimNotifications(this.user(req));
  }
  @Post('notifications/:id/acknowledge')
  acknowledge(
    @Req() req: IdentityRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AchievementNotificationAckDto,
  ) {
    return this.achievements.acknowledge(this.user(req), id, body.token);
  }
}
