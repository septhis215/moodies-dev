import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
} from 'src/auth/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';



@Injectable({})
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private readonly jwt: JwtService,
    private configService: ConfigService,
  ) { }

  signAccessToken(payload: { sub: number | string }) {
    return this.jwt.sign(
      { sub: String(payload.sub) },
      { expiresIn: '1d' }
    );
  }

  async signup(dto: RegisterDto) {
    // 1️check for existing email
    const existing = await this.prismaService.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    // hash password
    const hashedPassword = await argon.hash(dto.password);

    // create user (no createdAt field — Prisma fills it). The pre-check above is
    // a fast path; the unique constraint is the real guard against a concurrent
    // signup with the same email/username, so handle P2002 gracefully here.
    let user;
    try {
      user = await this.prismaService.user.create({
        data: {
          username: dto.username,
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          provider: 'credentials',
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        const field = target.includes('username') ? 'Username' : 'Email';
        throw new BadRequestException(`${field} already registered`);
      }
      throw e;
    }

    const token = await this.signToken(user.id, user.email);

    const { password, ...result } = user;
    return {
      message: 'User created successfully',
      user: result,
      token: token
    };
  }

  async signin(dto: LoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new ForbiddenException('Email not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'This account uses Google sign-in. Use "Continue with Google" or set a password first.'
      );
    }

    const pwMatches = await argon.verify(user.password, dto.password);
    if (!pwMatches) throw new UnauthorizedException('Invalid email or password');

    if (!pwMatches) {
      throw new ForbiddenException('Password is incorrect');
    }

    const token = await this.signToken(user.id, user.email);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    };
  }



  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) throw new ForbiddenException('User not found');

    if (!user.password) {
      throw new BadRequestException('No local password set for this account. Use "Set password" first.');
    }



    const ok = await argon.verify(user.password, dto.oldPassword);
    if (!ok) throw new UnauthorizedException('Old password is incorrect');

    const hash = await argon.hash(dto.newPassword);
    await this.prismaService.user.update({ where: { id: userId }, data: { password: hash } });
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) throw new ForbiddenException('Email not found');

    if (dto.newPassword !== dto.confirmPassword)
      throw new ForbiddenException('Passwords do not match');

    const newHashed = await argon.hash(dto.newPassword);
    await this.prismaService.user.update({
      where: {
        email: dto.email,
      },
      data: {
        password: newHashed,
      },
    });

    return { message: 'Password reset successful' };
  }

  private async signToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
    });
  }

  /**
   * Atomic, race-safe find-or-create for a Google account, keyed on email.
   * Concurrent first-time logins can't create duplicate users: the upsert (and
   * its P2002 fallback) collapses the race to a single row. Username is only set
   * on create — never changed on login — so it can't collide with another user.
   */
  private async upsertGoogleAccount(p: {
    email: string;
    name?: string;
    googleId: string;
    picture?: string | null;
  }) {
    const { email, name, googleId, picture } = p;

    const createData = {
      email,
      username: name || email.split('@')[0],
      provider: 'google',
      googleId,
      avatarUrl: picture ?? null,
      password: await argon.hash(`google:${uuid()}`),
    };
    const updateData = {
      provider: 'google',
      googleId,
      ...(picture ? { avatarUrl: picture } : {}),
    };

    try {
      return await this.prismaService.user.upsert({
        where: { email },
        create: createData,
        update: updateData,
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        // Lost the create race on email — the row now exists; just update it.
        if (target.includes('email')) {
          return this.prismaService.user.update({ where: { email }, data: updateData });
        }
        // Display-name collided with a different user — retry with a unique suffix.
        if (target.includes('username')) {
          return this.prismaService.user.create({
            data: { ...createData, username: `${createData.username}-${uuid().slice(0, 6)}` },
          });
        }
      }
      throw e;
    }
  }

  async googleLoginOrRegister(params: {
    email: string;
    name?: string;
    googleId: string;
    picture?: string;
  }) {
    const user = await this.upsertGoogleAccount(params);
    const token = await this.signToken(user.id, user.email);
    return { access_token: token, user };
  }

  async upsertGoogleUser(profile: any) {
    const { email, name, picture, googleId } = profile;
    return this.upsertGoogleAccount({ email, name, googleId, picture });
  }

  signTempToken(payload: { uid: number; mode: 'set' | 'verify' }) {
    return this.jwt.sign(payload, { expiresIn: '5m', subject: String(payload.uid), jwtid: 'temp' });
  }

}
