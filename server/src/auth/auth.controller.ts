import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UseGuards,
  Get,
  Query,
  Req,
  Res,
  Put,
  UnauthorizedException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from 'src/auth/decorator';
import * as authDto from './dto';
import * as User2 from '@prisma/client';
import * as argon from 'argon2';
import { JwtGuard } from './guard';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendVerificationCode } from '../utils/mailer';
import { PrismaService } from 'src/prisma/prisma.service';

const prisma = new PrismaClient();

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly PrismaService: PrismaService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  signup(@Body() dto: authDto.RegisterDto) {
    console.log(dto);
    return this.authService.signup(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signin(@Body() dto: authDto.LoginDto) {
    return this.authService.signin(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @Patch('change-password')
  changePassword(
    @Body() dto: authDto.ChangePasswordDto,
    @GetUser() user: User2.User,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: authDto.ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @Post('logout')
  logout(@GetUser() user: User2.User) {
    return { message: 'Loggout out successfullly' };
  }
 
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
  }

@Get('google/callback')
@UseGuards(AuthGuard('google'))
async googleCallback(@Req() req, @Res() res) {
  const user = req.user;

  if (!user?.email) {
      return res.status(400).json({ message: 'No email from Google' });
    }

    try {
      // Check user already exists by email
      let existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        existingUser = await prisma.user.create({
          data: {
            username: user.name,
            email: user.email,
            provider: 'google',
            googleId: user.googleId,
            password: user.password
          },
        });
        console.log('✅ User created in Prisma:', existingUser);
      } else {
        console.log('✅ Existing user found:', existingUser.email);
      }

      return res.redirect("http://localhost:3000/")
    } catch (err) {
      console.error('❌ Prisma error:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
  }


  @Post('request-reset')
  async requestReset(@Body('email') email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: true, message: 'If this email exists, a code was sent.' };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.emailVerification.create({
      data: { email, code, expiresAt },
    });

    await sendVerificationCode(email, code);
    return { success: true, message: 'Verification code sent to email.' };
  }

  @Post('verify-code')
  async verifyCode(@Body('email') email: string, @Body('code') code: string) {
    const record = await prisma.emailVerification.findFirst({
      where: { email, code, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return { success: false, message: 'Invalid verification code.' };
    if (record.expiresAt < new Date())
      return { success: false, message: 'Code expired.' };

    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    return { success: true, message: 'Email verified. You may now reset password.' };
  }

  @Post('reset-password')
  async resetPassword(
    @Body('email') email: string,
    @Body('newPassword') newPassword: string,
  ) {
    const verified = await prisma.emailVerification.findFirst({
      where: { email, verified: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!verified)
      return { success: false, message: 'Email not verified for password reset.' };

    const hash = await argon.hash(newPassword);
    await prisma.user.update({
      where: { email },
      data: { password: hash },
    });

    await prisma.emailVerification.update({
      where: { id: verified.id },
      data: { verified: false },
    });

    return { success: true, message: 'Password reset successful.' };
  }

  
  @UseGuards(JwtGuard)
  @Put('me/preferences')
  async upsertMyPreferences(
    @Req() req,
    @Body() body: { age?: number; preferredGenres?: string[]; preferredLanguages?: string[] }
  ) {
    // ✅ Make sure req.user.sub is available
    console.log('[preferences] req.user =', req.user);

    const userId = req.user?.sub ?? req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid token (no user id).');
    }

    const { age, preferredGenres, preferredLanguages } = body;

    // ✅ Build Prisma-compatible update data
    const data: any = {};
    if (typeof age === 'number') data.age = age;
    if (Array.isArray(preferredGenres)) {
      data.preferredGenres = { set: preferredGenres };  // ✅ must use set:
    }
    if (Array.isArray(preferredLanguages)) {
      data.preferredLanguages = { set: preferredLanguages }; // ✅ must use set:
    }

    // ✅ Correct property name for Prisma service
    return this.PrismaService.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        age: true,
        preferredGenres: true,
        preferredLanguages: true,
      },
    });
  }




}
