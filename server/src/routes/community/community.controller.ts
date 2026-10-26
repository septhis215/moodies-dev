import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from 'src/auth/guard';
import { OptionalJwtGuard } from 'src/auth/guard/optional-jwt.guard';
import { TurnstileAction } from 'src/common/security/turnstile-action.decorator';
import { TurnstileVerifiedGuard } from 'src/common/security/turnstile-verified.guard';
import { SetReactionDto } from '../review/dto/set-reaction.dto';
import { ReviewBanGuard } from '../review/guard/review-ban.guard';
import { CommunityService } from './community.service';
import {
  CommunityPageDto,
  CommunityTopicsQueryDto,
  CreateCommunityPostDto,
  CreateCommunityReplyDto,
} from './dto/community.dto';

type CommunityRequest = Request & { user: { id: string } };

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  @UseGuards(OptionalJwtGuard)
  getPosts(
    @Req() req: CommunityRequest,
    @Query() query: CommunityTopicsQueryDto,
  ) {
    return this.community.getPosts(query, req.user?.id);
  }

  @Get('posts/:id')
  @UseGuards(OptionalJwtGuard)
  getPost(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.community.getPost(id, req.user?.id);
  }

  @Post('posts')
  @TurnstileAction('review')
  @UseGuards(JwtGuard, ReviewBanGuard, TurnstileVerifiedGuard)
  createPost(
    @Req() req: CommunityRequest,
    @Body() dto: CreateCommunityPostDto,
  ) {
    return this.community.createPost(req.user.id, dto);
  }

  @Get('posts/:id/replies')
  @UseGuards(OptionalJwtGuard)
  getReplies(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.getReplies(id, query, req.user?.id);
  }

  @Post('posts/:id/replies')
  @TurnstileAction('reply')
  @UseGuards(JwtGuard, ReviewBanGuard, TurnstileVerifiedGuard)
  createReply(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunityReplyDto,
  ) {
    return this.community.createReply(req.user.id, id, dto);
  }

  @Post('posts/:id/reactions')
  @UseGuards(JwtGuard)
  setPostReaction(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReactionDto,
  ) {
    return this.community.setPostReaction(req.user.id, id, dto.type);
  }

  @Delete('posts/:id/reactions')
  @UseGuards(JwtGuard)
  removePostReaction(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.community.removePostReaction(req.user.id, id);
  }

  @Post('replies/:id/reactions')
  @UseGuards(JwtGuard)
  setReplyReaction(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReactionDto,
  ) {
    return this.community.setReplyReaction(req.user.id, id, dto.type);
  }

  @Delete('replies/:id/reactions')
  @UseGuards(JwtGuard)
  removeReplyReaction(
    @Req() req: CommunityRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.community.removeReplyReaction(req.user.id, id);
  }
}
