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
import * as argon from 'argon2'; // for password hashing
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
  ) {}

  async signup(dto: RegisterDto) {
    // 1️⃣  check for existing email
    const existing = await this.prismaService.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    // 2️⃣  hash password
    const hashedPassword = await argon.hash(dto.password);

    // 3️⃣  create user (no createdAt field — Prisma fills it)
    const user = await this.prismaService.user.create({
      data: {
        username: dto.username,
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        provider: 'credentials',
      },
    });

    const token = await this.signToken(user.id, user.email);

    const { password, ...result } = user;
    return {
      message: 'User created successfully',
      user: result,
      token:token
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
      expiresIn: process.env.JWT_EXPIRES || '7d',
    });
  }

  async googleLoginOrRegister(params: {
    email: string;
    name?: string;
    googleId: string;
  }) {
    const { email, name, googleId } = params;

    let user = await this.prismaService.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          email,
          username: name || email.split('@')[0],
          provider: 'google',
          googleId,
          password: await argon.hash(`google:${uuid()}`),
        },
      });
    } else {
      if (!user.googleId || user.provider !== 'google') {
        await this.prismaService.user.update({
          where: { id: user.id },
          data: { googleId, provider: 'google' },
        });
      }
    }

    const token = await this.signToken(user.id, user.email);
    return { access_token: token, user };
  }



}
