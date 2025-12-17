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
  UnauthorizedException,
  NotFoundException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from 'src/auth/decorator';
import * as authDto from './dto';
import * as User2 from '@prisma/client';
import * as argon from 'argon2';
import { JwtGuard } from './guard';
import { AuthGuard } from '@nestjs/passport';
import { PrismaClient } from '@prisma/client';
import { sendVerificationCode } from '../utils/mailer';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import type { Response as ExpressResponse } from 'express';



const prisma = new PrismaClient();

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly jwt: JwtService,
    private readonly PrismaService: PrismaService,
  ) { }

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

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleSignup(): void {
    // passport redirects automatically
  }


  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleSignupCallback(@Req() req: any, @Res() res: ExpressResponse) {
    // profile is returned by GoogleStrategy.validate()
    const profile = req.user;

    // Use the existing googleLoginOrRegister method which handles both login and signup
    const { access_token, user } = await this.authService.googleLoginOrRegister({
      email: profile.email,
      name: profile.name,
      googleId: profile.googleId,
    });

    const base = process.env.CLIENT_URL ?? 'http://localhost:3000';

    // Check if user has completed onboarding (has preferences set)
    const needsOnboarding = !user.age || !user.preferredGenres?.length || !user.preferredLanguages?.length;

    if (needsOnboarding) {
      // New user or incomplete profile - redirect to onboarding with token
      return res.redirect(`${base}/auth/onboarding?token=${encodeURIComponent(access_token)}`);
    }

    // Existing user with complete profile - redirect directly to home with token
    // The AuthContext will pick up the token and show the toast
    return res.redirect(`${base}/?token=${encodeURIComponent(access_token)}&google_login=true`);
  }

  /* ================= PASSWORD ENDPOINTS ================= */

  @Post('set-password')
  async setPassword(@Body() body: { token: string; password: string }) {
    const { token, password } = body;

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch (e: any) {
      throw new UnauthorizedException(e.message);
    }
    if (payload?.mode !== 'set') throw new UnauthorizedException('Invalid mode');

    const uid = String(payload.uid);
    if (!uid) throw new UnauthorizedException('Invalid user id');

    const hash = await argon.hash(password, {
      type: argon.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await this.PrismaService.user.update({
      where: { id: uid },
      data: { password: hash, provider: 'google' },
    });

    const user = await this.PrismaService.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
      },
    });

    const accessToken = this.authService.signAccessToken({ sub: uid });

    return { token: accessToken, user };
  }

  @Post('verify-password')
  async verifyPassword(@Body() body: { token: string; password: string }) {
    const { token, password } = body;

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch (e: any) {
      throw new UnauthorizedException(e.message);
    }
    if (payload?.mode !== 'verify') throw new UnauthorizedException('Invalid mode');

    const uid = String(payload.uid);
    if (!uid) throw new UnauthorizedException('Invalid user id');

    const user = await this.PrismaService.user.findUnique({ where: { id: uid } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.password) throw new UnauthorizedException('No password set');

    const ok = await argon.verify(user.password, password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.authService.signAccessToken({ sub: uid });
    return { token: accessToken };
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
  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.uid;
    if (!userId) return null;
    return this.PrismaService.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        age: true,
        preferredGenres: true,
        preferredLanguages: true,
      },
    });
  }


  @UseGuards(JwtGuard)
  @Put('me/preferences')
  async upsertMyPreferences(
    @Req() req,
    @Body() body: { age?: number; preferredGenres?: string[]; preferredLanguages?: string[] }
  ) {

    console.log('[preferences] req.user =', req.user);

    const userId = req.user?.sub ?? req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid token (no user id).');
    }

    const { age, preferredGenres, preferredLanguages } = body;


    const data: any = {};
    if (typeof age === 'number') data.age = age;
    if (Array.isArray(preferredGenres)) {
      data.preferredGenres = { set: preferredGenres };
    }
    if (Array.isArray(preferredLanguages)) {
      data.preferredLanguages = { set: preferredLanguages };
    }

    return this.PrismaService.user.update({
      where: { id: String(userId) },
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
