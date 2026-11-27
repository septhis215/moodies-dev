import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { EmailVerificationCleanupService } from './email-verification-cleanup.service';
import { RecommendationCleanupService } from './recommendation-cleanup.service';
import { MoviesModule } from 'src/modules/media/movies/movies.module';
import { TvModule } from 'src/modules/media/tv/tv.module';
import { AllModule } from 'src/modules/media/all/all.module';
import { MoodsModule } from 'src/modules/moods/moods.module';

@Module({
  imports: [MoviesModule, TvModule, AllModule, MoodsModule],
  providers: [
    SeedService,
    EmailVerificationCleanupService,
    RecommendationCleanupService,
  ],
})
export class JobsModule {}
