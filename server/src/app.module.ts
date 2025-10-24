import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UserModule,
    PrismaModule,
    RedisModule,
    MoviesModule,
    TvModule,
    AllModule,
    QuizModule,
    PeopleModule,
    SearchModule,
    MoodsModule,
  ],
  providers: [],
  controllers: [SearchController, MoodsController],
})
export class AppModule {}
