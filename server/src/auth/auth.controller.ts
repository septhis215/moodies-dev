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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from 'src/auth/decorator';
import * as authDto from './dto';
import * as User2 from '@prisma/client';
import * as argon from 'argon2';
import { JwtGuard } from './guard';
import { AuthGuard } from '@nestjs/passport';
import { sendVerificationCode } from '../utils/mailer';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import type { Response as ExpressResponse } from 'express';
import { UpdateProfileDto } from './dto';
import { randomInt } from 'node:crypto';

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
    // Do not log `dto` — it contains the plaintext password.
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

  // NOTE: The old `POST /auth/forgot-password` endpoint was removed. It reset a
  // user's password given only an email + new password, with no proof of
  // ownership — a trivial account-takeover vector. Password recovery now goes
  // exclusively through the verified flow: request-reset → verify-code →
  // reset-password (see below), which the client already uses.

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
      picture: profile.picture,
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

    // These endpoints take an inline body rather than a validated DTO, so the
    // global ValidationPipe does not enforce password strength here — check it.
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
      throw new BadRequestException('Password must be between 8 and 100 characters');
    }

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch (e: any) {
      throw new UnauthorizedException('Invalid or expired token');
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
      throw new UnauthorizedException('Invalid or expired token');
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
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    const user = await this.PrismaService.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Generic response — never reveal whether the email is registered.
      return { success: true, message: 'If this email exists, a code was sent.' };
    }

    // crypto.randomInt is cryptographically secure; Math.random is predictable
    // and unacceptable for a security token.
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.PrismaService.emailVerification.create({
      data: { email: normalizedEmail, code, expiresAt },
    });

    await sendVerificationCode(normalizedEmail, code);
    return { success: true, message: 'If this email exists, a code was sent.' };
  }

  @Post('verify-code')
  async verifyCode(@Body('email') email: string, @Body('code') code: string) {
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    // Atomically flip an unused, unexpired code to verified. Doing the match and
    // the write in one statement prevents two concurrent verifies from racing.
    const { count } = await this.PrismaService.emailVerification.updateMany({
      where: { email: normalizedEmail, code, verified: false, expiresAt: { gt: new Date() } },
      data: { verified: true },
    });

    if (count > 0) {
      return { success: true, message: 'Email verified. You may now reset password.' };
    }

    // Nothing flipped — figure out why for a helpful message.
    const record = await this.PrismaService.emailVerification.findFirst({
      where: { email: normalizedEmail, code },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return { success: false, message: 'Invalid verification code.' };
    if (record.expiresAt < new Date()) return { success: false, message: 'Code expired.' };
    return { success: false, message: 'Code already used.' };
  }

  @Post('reset-password')
  async resetPassword(
    @Body('email') email: string,
    @Body('newPassword') newPassword: string,
  ) {
    // Inline body (no DTO) — enforce password strength explicitly.
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 100) {
      throw new BadRequestException('Password must be between 8 and 100 characters');
    }
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    const hash = await argon.hash(newPassword);

    // Atomically consume the verified token first, so it can't be replayed by a
    // concurrent reset. Only proceed to set the password if we actually consumed one.
    const { count } = await this.PrismaService.emailVerification.updateMany({
      where: { email: normalizedEmail, verified: true },
      data: { verified: false },
    });

    if (count === 0) {
      return { success: false, message: 'Email not verified for password reset.' };
    }

    await this.PrismaService.user.update({
      where: { email: normalizedEmail },
      data: { password: hash },
    });

    return { success: true, message: 'Password reset successful.' };
  }

  @UseGuards(JwtGuard)
  @Patch('me/profile')
  async updateProfile(
    @Req() req: any,
    @Body() body: UpdateProfileDto,
  ) {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.uid;
    if (!userId) throw new UnauthorizedException('Invalid token');

    const { name, username, disclosure } = body;
    if (!name?.trim() && !username?.trim() && !disclosure) {
      throw new BadRequestException('At least one profile field is required');
    }

    const data: {
      name?: string;
      username?: string;
      discloseProfileInfo?: boolean;
      discloseWatchlist?: boolean;
      discloseReviews?: boolean;
      discloseLiked?: boolean;
      discloseBadges?: boolean;
      discloseRecentActivity?: boolean;
    } = {};
    if (name?.trim()) {
      if (name.trim().length < 2 || name.trim().length > 50) {
        throw new BadRequestException('Display name must be between 2 and 50 characters');
      }
      data.name = name.trim();
    }
    if (username?.trim()) {
      // basic username validation
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        throw new BadRequestException('Username must be 3-20 characters and contain only letters, numbers, or underscores');
      }
      // explicit duplicate check — catch it before hitting the DB constraint
      const existing = await this.PrismaService.user.findUnique({
        where: { username: username.trim() },
        select: { id: true },
      });
      if (existing && existing.id !== String(userId)) {
        throw new BadRequestException('Username is already taken');
      }
      data.username = username.trim();
    }
    if (disclosure) {
      if (typeof disclosure.profileInfo === 'boolean') data.discloseProfileInfo = disclosure.profileInfo;
      if (typeof disclosure.watchlist === 'boolean') data.discloseWatchlist = disclosure.watchlist;
      if (typeof disclosure.reviews === 'boolean') data.discloseReviews = disclosure.reviews;
      if (typeof disclosure.liked === 'boolean') data.discloseLiked = disclosure.liked;
      if (typeof disclosure.badges === 'boolean') data.discloseBadges = disclosure.badges;
      if (typeof disclosure.recentActivity === 'boolean') data.discloseRecentActivity = disclosure.recentActivity;
    }

    try {
      const updated = await this.PrismaService.user.update({
        where: { id: String(userId) },
        data,
        select: {
          id: true,
          name: true,
          username: true,
          discloseProfileInfo: true,
          discloseWatchlist: true,
          discloseReviews: true,
          discloseLiked: true,
          discloseBadges: true,
          discloseRecentActivity: true,
        },
      });
      return {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        disclosure: {
          profileInfo: updated.discloseProfileInfo,
          watchlist: updated.discloseWatchlist,
          reviews: updated.discloseReviews,
          liked: updated.discloseLiked,
          badges: updated.discloseBadges,
          recentActivity: updated.discloseRecentActivity,
        },
      };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Username is already taken');
      }
      throw e;
    }
  }

  @UseGuards(JwtGuard)
  @Patch('me/avatar')
  async updateAvatar(@Req() req: any, @Body() body: { avatarUrl: string }) {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.uid;
    if (!userId) throw new UnauthorizedException('Invalid token');

    const { avatarUrl } = body;
    if (!avatarUrl) throw new BadRequestException('avatarUrl is required');

    // Accept base64 data URLs (image/*) or https URLs
    const isBase64 = avatarUrl.startsWith('data:image/');
    const isHttps = avatarUrl.startsWith('https://');
    if (!isBase64 && !isHttps) {
      throw new BadRequestException('avatarUrl must be a base64 data URL or https URL');
    }

    // Enforce a ~200KB limit on base64 payloads (~150KB image after encoding overhead)
    if (isBase64 && avatarUrl.length > 200_000) {
      throw new BadRequestException('Image too large. Please upload a smaller image.');
    }

    const updated = await this.PrismaService.user.update({
      where: { id: String(userId) },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });

    return updated;
  }

  @UseGuards(JwtGuard)
  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.uid;
    if (!userId) return null;
    const user = await this.PrismaService.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatarUrl: true,
        provider: true,
        reviewBannedUntil: true,
        reviewWarningScore: true,
        age: true,
        preferredGenres: true,
        preferredLanguages: true,
        discloseProfileInfo: true,
        discloseWatchlist: true,
        discloseReviews: true,
        discloseLiked: true,
        discloseBadges: true,
        discloseRecentActivity: true,
      },
    });
    return user && ({
      ...user,
      disclosure: {
        profileInfo: user.discloseProfileInfo,
        watchlist: user.discloseWatchlist,
        reviews: user.discloseReviews,
        liked: user.discloseLiked,
        badges: user.discloseBadges,
        recentActivity: user.discloseRecentActivity,
      },
    });
  }

  @UseGuards(JwtGuard)
  @Get('me/achievements')
  async myAchievements(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.uid;
    if (!userId) throw new UnauthorizedException('Invalid token');
    const achievements = await this.authService.getAchievementProgress(String(userId));
    return {
      achievements: achievements.map(({ achievement, badge, progress }) => ({
        achievement: {
          id: achievement.id,
          key: achievement.key,
          title: achievement.title,
          description: achievement.description,
          category: achievement.category,
          requirementType: achievement.requirementType,
          requirementTarget: achievement.requirementTarget,
          requiredCount: achievement.requiredCount,
          progressLogic: achievement.progressLogic,
          reasoningTemplate: achievement.reasoningTemplate,
          lockedHint: achievement.lockedHint,
          active: achievement.active,
        },
        badge,
        progress,
      })),
    };
  }


  @UseGuards(JwtGuard)
  @Put('me/preferences')
  async upsertMyPreferences(
    @Req() req,
    @Body() body: { age?: number; preferredGenres?: string[]; preferredLanguages?: string[] }
  ) {
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
