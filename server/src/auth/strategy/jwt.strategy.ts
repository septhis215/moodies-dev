import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // can be used for user testing
  async validate(payload: { sub: string; email: string }) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub, // sub represents an id
      },
    });

    if (!user) return null;

    return user;
  }
}
