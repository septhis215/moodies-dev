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
import { JwtGuard } from 'src/auth/guard';
import { TmdbClientService } from 'src/media/all/client/tmdb-client.service';
import { ContentSnapshotController } from './content-snapshot.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ReviewController, ContentSnapshotController],
  providers: [
    ReviewService,
    ProfanityFilterService,
    ToxicityAnalysisService,
    ModerationDecisionService,
    UserService,
    PrismaService,
    ReviewBanGuard,
    JwtGuard,
    TmdbClientService,
  ],
})
export class ReviewModule {}
