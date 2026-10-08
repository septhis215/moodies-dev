import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { EmailVerificationCleanupService } from './email-verification-cleanup.service';
import { RecommendationCleanupService } from './recommendation-cleanup.service';
import { MoviesModule } from 'src/media/movies/movies.module';
import { TvModule } from 'src/media/tv/tv.module';
import { AllModule } from 'src/media/all/all.module';
import { MoodsModule } from 'src/routes/moods/moods.module';

@Module({
  imports: [MoviesModule, TvModule, AllModule, MoodsModule],
  providers: [
    SeedService,
    EmailVerificationCleanupService,
    RecommendationCleanupService,
  ],
})
export class JobsModule {}
