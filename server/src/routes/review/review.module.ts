import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ProfanityFilterService } from '../moderation/profanity-filter.service';
import { ToxicityAnalysisService } from '../moderation/toxicity-analysis.service';
import { ModerationDecisionService } from '../moderation/moderation-decision.service';
import { UserService } from './../user/user.service';
import { PrismaService } from './../../prisma/prisma.service';

@Module({
  controllers: [ReviewController],
  providers: [
    ReviewService,
    ProfanityFilterService,
    ToxicityAnalysisService,
    ModerationDecisionService,
    UserService,
    PrismaService,
  ],
})
export class ReviewModule {}
