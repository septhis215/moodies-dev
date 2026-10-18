import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy';
import { GoogleStrategy } from './strategy/google.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PassportModule } from '@nestjs/passport';
import { AuthSessionService } from './auth-session.service';
import { accessTtlMs } from './auth.config';
import { AuthSessionCleanupService } from './auth-session-cleanup.service';
import { CookieOriginGuard } from './cookie-origin.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: accessTtlMs() / 1000 },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, AuthSessionCleanupService, CookieOriginGuard, JwtStrategy, PrismaService, GoogleStrategy],
  exports: [PassportModule, JwtModule, JwtStrategy, AuthService],
})
export class AuthModule { }
