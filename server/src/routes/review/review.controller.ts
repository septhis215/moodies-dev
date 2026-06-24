import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { OptionalJwtGuard } from 'src/auth/guard/optional-jwt.guard';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { SetReactionDto } from './dto/set-reaction.dto';
import { ReviewBanGuard } from './guard/review-ban.guard';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewsService: ReviewService) {}

  @Post()
  @UseGuards(JwtGuard)
  @UseGuards(ReviewBanGuard)
  createReview(@Req() req, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, dto);
  }

  @Post(':id/replies')
  @UseGuards(JwtGuard)
  @UseGuards(ReviewBanGuard)
  replyToReview(
    @Req() req,
    @Param('id') reviewId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.reviewsService.createReply(req.user.id, reviewId, dto);
  }

  @Post(':id/reactions')
  @UseGuards(JwtGuard)
  reactToReview(
    @Req() req,
    @Param('id') reviewId: string,
    @Body() dto: SetReactionDto,
  ) {
    return this.reviewsService.setReviewReaction(req.user.id, reviewId, dto.type);
  }

  @Delete(':id/reactions')
  @UseGuards(JwtGuard)
  removeReviewReaction(@Req() req, @Param('id') reviewId: string) {
    return this.reviewsService.removeReviewReaction(req.user.id, reviewId);
  }

  @Post('replies/:id/reactions')
  @UseGuards(JwtGuard)
  reactToReply(
    @Req() req,
    @Param('id') replyId: string,
    @Body() dto: SetReactionDto,
  ) {
    return this.reviewsService.setReplyReaction(req.user.id, replyId, dto.type);
  }

  @Delete('replies/:id/reactions')
  @UseGuards(JwtGuard)
  removeReplyReaction(@Req() req, @Param('id') replyId: string) {
    return this.reviewsService.removeReplyReaction(req.user.id, replyId);
  }

  @Get()
  getReviews(@Query() query: ReviewQueryDto) {
    return this.reviewsService.getReviews(query);
  }

  @Get('critics-corner/movies')
  getMovieCriticsCorner(@Query('limit') limit?: number) {
    return this.reviewsService.getMovieCriticsCorner(limit);
  }

  @Get('critics-corner/tv')
  getTVCriticsCorner(@Query('limit') limit?: number) {
    return this.reviewsService.getTVCriticsCorner(limit);
  }

  @Get('community-picks')
  getCommunityPicks(@Query('limit') limit?: number) {
    return this.reviewsService.getCommunityPicks(limit);
  }

  @Get('users/:userId/profile')
  getPublicUserProfile(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getPublicUserProfile(userId, limit);
  }

  @Get('media/:mediaType/:tmdbId')
  @UseGuards(OptionalJwtGuard)
  getMediaReviews(
    @Req() req,
    @Param('mediaType') mediaType: string,
    @Param('tmdbId') tmdbId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getMediaReviews(
      parseInt(tmdbId),
      mediaType,
      page,
      limit,
      req.user?.id,
    );
  }

  @Get('media/:mediaType/:tmdbId/top-moods')
  getTopMoods(
    @Param('mediaType') mediaType: string,
    @Param('tmdbId') tmdbId: string,
  ) {
    return this.reviewsService.getTopMoods(parseInt(tmdbId), mediaType);
  }

  @Get('media/:mediaType/:tmdbId/stats')
  getReviewStats(
    @Param('mediaType') mediaType: string,
    @Param('tmdbId') tmdbId: string,
  ) {
    return this.reviewsService.getReviewStats(parseInt(tmdbId), mediaType);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  getMyReviews(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getMyReviews(req.user.id, page, limit);
  }

  @Get('me/ban-status')
  @UseGuards(JwtGuard)
  getBanStatus(@Req() req) {
    return this.reviewsService.getReviewBanStatus(req.user);
  }
}
