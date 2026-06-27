import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
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
      // Fail fast at boot on missing/invalid config instead of crashing later at
      // first use. allowUnknown MUST stay true — otherwise Joi rejects every other
      // process.env key (PATH, NODE, Railway-injected vars, …) and the app won't start.
      // `.empty('')` treats a present-but-empty env var ("") as absent, so a
      // platform that injects empty strings (Railway, etc.) gets defaults applied
      // and optionals satisfied instead of a boot crash. Required vars still fail
      // on empty, which is what we want.
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production')
          .empty('')
          .default('development'),
        PORT: Joi.number().empty('').default(3001),
        // Required — the app cannot function without these.
        JWT_SECRET: Joi.string().required(), // recommend >= 32 random chars
        DATABASE_URL: Joi.string().required(),
        // Optional / have safe defaults in code.
        JWT_ACCESS_EXPIRES: Joi.string().empty('').default('15m'),
        REFRESH_EXPIRES_DAYS: Joi.number().empty('').default(30),
        DIRECT_URL: Joi.string().empty('').optional(),
        TMDB_API_KEY: Joi.string().empty('').optional(),
        REDIS_HOST: Joi.string().empty('').optional(),
        REDIS_PORT: Joi.number().empty('').optional(),
        REDIS_PASS: Joi.string().allow('').optional(),
        COOKIE_SAMESITE: Joi.string().valid('lax', 'strict', 'none').empty('').optional(),
        COOKIE_SECURE: Joi.string().valid('true', 'false').empty('').optional(),
        COOKIE_DOMAIN: Joi.string().empty('').optional(),
        CLIENT_URL: Joi.string().empty('').optional(),
        CORS_ORIGINS: Joi.string().empty('').optional(),
        GOOGLE_CLIENT_ID: Joi.string().empty('').optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().empty('').optional(),
        GOOGLE_CALLBACK_URL: Joi.string().empty('').optional(),
        // Email (Resend over HTTPS). Optional so boot never depends on them; the
        // mailer throws a clear error at send time if RESEND_API_KEY is missing.
        RESEND_API_KEY: Joi.string().empty('').optional(),
        MAIL_FROM: Joi.string().empty('').optional(),
        MAIL_SUPPORT: Joi.string().empty('').optional(),
        // Avatar object storage (Supabase Storage). Optional so boot never depends
        // on them; the avatar endpoint errors clearly at use if unset.
        SUPABASE_URL: Joi.string().empty('').optional(),
        SUPABASE_SERVICE_ROLE_KEY: Joi.string().empty('').optional(),
        AVATAR_BUCKET: Joi.string().empty('').optional(),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
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
