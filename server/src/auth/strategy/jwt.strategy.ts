import { Injectable } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { ACCESS_COOKIE, readCookie } from '../auth.cookies';

// Read the access token exclusively from the HttpOnly cookie.
const cookieExtractor = (req: Request): string | null =>
  readCookie(req, ACCESS_COOKIE) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // 'jwt', auth guard automatically identify this keyword
  constructor(
    configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    const secret = configService.get('JWT_SECRET');

    if (!secret)
      throw new Error('JWT_SECRET is not defined in environment variables');
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    // Never log the JWT secret (or any secret) — logs are frequently shipped to
    // third parties and persisted far longer than the app process.
  }

  // can be used for user testing
  async validate(payload: { sub: string; email: string }) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        email: true,
        username: true,
        reviewBannedUntil: true,
        reviewWarningScore: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      reviewBannedUntil: user.reviewBannedUntil,
      reviewWarningScore: user.reviewWarningScore,
    };
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
