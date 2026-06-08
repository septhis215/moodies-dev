import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ProfanityFilterService } from '../moderation/profanity-filter.service';
import { ToxicityAnalysisService } from '../moderation/toxicity-analysis.service';
import { ModerationDecisionService } from '../moderation/moderation-decision.service';
import { UserService } from './../user/user.service';
import { PrismaService } from './../../prisma/prisma.service';
import { ReviewBanGuard } from './guard/review-ban.guard';
import { JwtAuthGuard } from 'src/auth/strategy';
import { TmdbClientService } from 'src/media/all/client/tmdb-client.service';

@Module({
  imports: [ConfigModule],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    ProfanityFilterService,
    ToxicityAnalysisService,
    ModerationDecisionService,
    UserService,
    PrismaService,
    ReviewBanGuard,
    JwtAuthGuard,
    TmdbClientService,
  ],
})
export class ReviewModule {}
