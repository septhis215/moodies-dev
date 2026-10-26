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
import { CommunityModule } from './routes/community/community.module';
import { ModerationModule } from './routes/moderation/moderation.module';
import { LikedModule } from './liked/liked.module';
import { MediaStatsModule } from './media-stats/media-stats.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TurnstileModule } from './common/security/turnstile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // Fail fast at boot on missing/invalid config instead of crashing later at
      // first use. allowUnknown MUST stay true — otherwise Joi rejects every other
      // process.env key (PATH, NODE, platform-injected vars, …) and the app won't start.
      // `.empty('')` treats a present-but-empty env var ("") as absent, so a
      // platform that injects empty strings gets defaults applied
      // and optionals satisfied instead of a boot crash. Required vars still fail
      // on empty, which is what we want.
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production')
          .empty('')
          .default('development'),
        PORT: Joi.number().empty('').default(3001),
        BIND_HOST: Joi.string().ip().empty('').default('0.0.0.0'),
        // Required — the app cannot function without these.
        JWT_SECRET: Joi.string().required(), // recommend >= 32 random chars
        DATABASE_URL: Joi.string().required(),
        // Optional / have safe defaults in code.
        JWT_ACCESS_EXPIRES: Joi.string().empty('').default('15m'),
        REFRESH_EXPIRES_DAYS: Joi.number().positive().empty('').default(30),
        DIRECT_URL: Joi.string().empty('').optional(),
        TMDB_API_KEY: Joi.string().empty('').optional(),
        YOUTUBE_API_KEY: Joi.string().empty('').optional(),
        YOUTUBE_DAILY_SEARCH_LIMIT: Joi.number()
          .integer()
          .min(1)
          .max(100)
          .empty('')
          .default(60),
        YOUTUBE_REGION_CODE: Joi.string()
          .pattern(/^[A-Z]{2}$/)
          .empty('')
          .optional(),
        CELEBRITY_MEDIA_USER_AGENT: Joi.string().empty('').optional(),
        CELEBRITY_MEDIA_IDENTITIES: Joi.string().empty('').optional(),
        TURNSTILE_SECRET_KEY: Joi.string().empty('').optional(),
        TURNSTILE_VERIFY_URL: Joi.string().empty('').optional(),
        TURNSTILE_COOKIE_SECRET: Joi.string().empty('').optional(),
        TURNSTILE_ALLOWED_HOSTNAMES: Joi.string().empty('').optional(),
        TURNSTILE_VERIFY_TIMEOUT_MS: Joi.number()
          .integer()
          .min(100)
          .max(10000)
          .empty('')
          .default(4000),
        TURNSTILE_MAX_CONCURRENT: Joi.number()
          .integer()
          .min(1)
          .max(1000)
          .empty('')
          .default(64),
        TRUST_PROXY: Joi.string()
          .valid('true', 'false')
          .empty('')
          .default('false'),
        TRUSTED_PROXY_CIDRS: Joi.string()
          .empty('')
          .when('TRUST_PROXY', {
            is: 'true',
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        RATE_LIMIT_GLOBAL_PER_MINUTE: Joi.number()
          .integer()
          .min(1)
          .max(100000)
          .empty('')
          .default(600),
        RATE_LIMIT_AUTH_IP_PER_MINUTE: Joi.number()
          .integer()
          .min(1)
          .max(10000)
          .empty('')
          .default(30),
        RATE_LIMIT_READ_IP_PER_MINUTE: Joi.number()
          .integer()
          .min(1)
          .max(100000)
          .empty('')
          .default(300),
        REDIS_CONNECT_TIMEOUT_MS: Joi.number()
          .integer()
          .min(100)
          .max(10000)
          .empty('')
          .default(1500),
        REDIS_COMMAND_TIMEOUT_MS: Joi.number()
          .integer()
          .min(100)
          .max(10000)
          .empty('')
          .default(1500),
        REDIS_HOST: Joi.string().empty('').optional(),
        REDIS_PORT: Joi.number().empty('').optional(),
        REDIS_PASS: Joi.string().allow('').optional(),
        REDIS_URL: Joi.string()
          .uri({ scheme: ['redis', 'rediss'] })
          .empty('')
          .optional(),
        COOKIE_SAMESITE: Joi.string()
          .valid('lax', 'strict', 'none')
          .empty('')
          .optional(),
        COOKIE_SECURE: Joi.string().valid('true', 'false').empty('').optional(),
        COOKIE_DOMAIN: Joi.string().empty('').optional(),
        CLIENT_URL: Joi.string().empty('').optional(),
        CORS_ORIGINS: Joi.string().empty('').optional(),
        GOOGLE_CLIENT_ID: Joi.string().empty('').optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().empty('').optional(),
        GOOGLE_CALLBACK_URL: Joi.string().empty('').optional(),
        // Hostinger SMTP is required on hosted backends; no network call at boot.
        MAIL_USER: Joi.string()
          .email()
          .empty('')
          .when('NODE_ENV', {
            is: Joi.valid('staging', 'production'),
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        MAIL_PASS: Joi.string()
          .empty('')
          .when('MAIL_USER', {
            is: Joi.exist(),
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        SMTP_HOST: Joi.string()
          .hostname()
          .empty('')
          .default('smtp.hostinger.com'),
        SMTP_PORT: Joi.number().valid(465, 587).empty('').default(465),
        MAIL_FROM: Joi.string()
          .pattern(/^[^\r\n]+$/)
          .empty('')
          .optional(),
        MAIL_SUPPORT: Joi.string().email().empty('').optional(),
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
    CommunityModule,
    ModerationModule,
    TurnstileModule,
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
