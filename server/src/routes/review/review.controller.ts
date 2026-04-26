import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/strategy';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewBanGuard } from './guard/review-ban.guard';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewsService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseGuards(ReviewBanGuard)
  createReview(@Req() req, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, dto);
  }

  @Post(':id/replies')
  @UseGuards(JwtAuthGuard)
  @UseGuards(ReviewBanGuard)
  replyToReview(
    @Req() req,
    @Param('id') reviewId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.reviewsService.createReply(req.user.id, reviewId, dto);
  }

  @Get()
  getReviews(@Query() query: ReviewQueryDto) {
    return this.reviewsService.getReviews(query);
  }

  @Get('media/:mediaType/:tmdbId')
  getMediaReviews(
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
  @UseGuards(JwtAuthGuard)
  getMyReviews(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getMyReviews(req.user.id, page, limit);
  }

  @Get('me/ban-status')
  @UseGuards(JwtAuthGuard)
  getBanStatus(@Req() req) {
    return this.reviewsService.getReviewBanStatus(req.user);
  }
}
