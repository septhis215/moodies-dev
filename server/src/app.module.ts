import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ExternalApisModule } from './external-apis/external-apis.module';
import { JobsModule } from './jobs/jobs.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './routes/user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MoviesModule } from './media/movies/movies.module';
import { TvModule } from './media/tv/tv.module';
import { AllModule } from './media/all/all.module';
import { PeopleModule } from './media/people/people.module';
import { SearchController } from './routes/search/search.controller';
import { SearchModule } from './routes/search/search.module';
import { MoodsController } from './routes/moods/moods.controller';
import { MoodsModule } from './routes/moods/moods.module';
import { QuizModule } from './quiz/quiz.module';
import { CategoryModule } from './media/category/category.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { ReviewModule } from './routes/review/review.module';
import { ModerationModule } from './routes/moderation/moderation.module';
import { LikedModule } from './liked/liked.module';
import { MediaStatsModule } from './media-stats/media-stats.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ExternalApisModule,
    JobsModule,
    AuthModule,
    UserModule,
    PrismaModule,
    WatchlistModule,
    LikedModule,
    MediaStatsModule,
    RedisModule,
    MoviesModule,
    TvModule,
    AllModule,
    QuizModule,
    PeopleModule,
    SearchModule,
    MoodsModule,
    CategoryModule,
    ReviewModule,
    ModerationModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  controllers: [AppController, SearchController, MoodsController],
})
export class AppModule {}
