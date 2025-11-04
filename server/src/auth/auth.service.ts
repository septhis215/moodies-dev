import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
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
  jwt: any;
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(dto: RegisterDto) {
    const hashedPassword = await argon.hash(dto.password);

    try {
      const { password, ...rest } = dto; // remove the raw password from the dto object
      const user = await this.prismaService.user.create({
        data: {
          ...rest,
          password: hashedPassword,
        },
      });

      return this.signToken(user.id, user.email); // assign token session to user
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Email or username already taken');
        }
        if (error.code === 'P2003') {
          throw new ForbiddenException(
            'Invalid foreign key references, related record not found',
          ); // leave this for debugging
        }

        throw new InternalServerErrorException('Something went wrong');
      }
    }
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

    const pwMatches = await argon.verify(user.password, dto.password);

    if (!pwMatches) {
      throw new ForbiddenException('Password is incorrect');
    }

    return this.signToken(user.id, user.email); // assign token session to user
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) throw new ForbiddenException('User not found');

    const pwMatches = await argon.verify(user.password, dto.oldPassword);
    if (!pwMatches) throw new ForbiddenException('Old password is incorrect');

    const newHashed = await argon.hash(dto.newPassword);
    await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        password: newHashed,
      },
    });

    return { message: 'Password changed successfully' };
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

    async signToken(userId: string, email: string): Promise<string> {
      return this.jwt.sign(
        { sub: userId, email },
        { expiresIn: '30m' }
      );
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
