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
import { PasswordModule } from './routes/auth/password.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ session: false }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '30m' },
    }),
    AuthModule,
    UserModule,
    PrismaModule,
    RedisModule,
    MoviesModule,
    TvModule,
    AllModule,
    PeopleModule,
    SearchModule,
    MoodsModule,
    PasswordModule,
  ],
  providers: [],
  controllers: [SearchController, MoodsController],
})
export class AppModule {}
