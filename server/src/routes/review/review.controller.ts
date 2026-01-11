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
@UseGuards(JwtAuthGuard, ReviewBanGuard)
export class ReviewController {
  constructor(private readonly reviewsService: ReviewService) {}

  @Post()
  createReview(@Req() req, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, dto);
  }

  @Post(':id/replies')
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
}
