import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UseGuards,
  Get,
  Req,
  Res,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetUser } from 'src/auth/decorator';
import * as authDto from './dto';
import * as User2 from '@prisma/client';
import { JwtGuard } from './guard';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { UpdateProfileDto } from './dto';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  setAuthCookies,
} from './auth.cookies';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Get('bootstrap')
  bootstrap(@Req() req: ExpressRequest) {
    return this.authService.getBootstrapFromAccessToken(
      readCookie(req, ACCESS_COOKIE),
    );
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  async signup(
    @Body() dto: authDto.RegisterDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Do not log `dto` — it contains the plaintext password.
    const result = await this.authService.signup(dto);
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      result.user.id,
      result.user.email,
    );
    setAuthCookies(res, accessToken, refreshToken);
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  async signin(
    @Body() dto: authDto.LoginDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.signin(dto);
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      result.user.id,
      result.user.email,
    );
    setAuthCookies(res, accessToken, refreshToken);
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const rotated = await this.authService.rotateRefreshToken(
      readCookie(req, REFRESH_COOKIE) ?? '',
    );
    if (!rotated) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Invalid or expired session');
    }
    setAuthCookies(res, rotated.accessToken, rotated.refreshToken);
    return { ok: true };
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
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Revoke the refresh token server-side and clear both cookies, so logout
    // actually invalidates the session rather than just deleting a client copy.
    await this.authService.revokeRefreshToken(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res);
    return { message: 'Logged out successfully' };
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
    const { user } = await this.authService.googleLoginOrRegister({
      email: profile.email,
      name: profile.name,
      googleId: profile.googleId,
      picture: profile.picture,
    });

    // Establish the session as HttpOnly cookies. The access token is NEVER placed
    // in the redirect URL (it would leak via history, logs and the Referer header).
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      user.id,
      user.email,
    );
    setAuthCookies(res, accessToken, refreshToken);

    const base = process.env.CLIENT_URL ?? 'http://localhost:3000';

    // Check if user has completed onboarding (has preferences set)
    const needsOnboarding = !user.age || !user.preferredGenres?.length || !user.preferredLanguages?.length;

    // Redirect with no token in the URL; the client reads identity from /auth/me.
    return res.redirect(
      needsOnboarding
        ? `${base}/auth/onboarding`
        : `${base}/?google_login=true`,
    );
  }

  /* ================= PASSWORD RESET (email-code flow) ================= */

  @Post('request-reset')
  requestReset(@Body('email') email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Post('verify-code')
  verifyCode(@Body('email') email: string, @Body('code') code: string) {
    return this.authService.verifyResetCode(email, code);
  }

  @Post('reset-password')
  resetPassword(
    @Body('email') email: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(email, newPassword);
  }

  @UseGuards(JwtGuard)
  @Patch('me/profile')
  updateProfile(@GetUser() user: User2.User, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, body);
  }

  @UseGuards(JwtGuard)
  @Patch('me/avatar')
  updateAvatar(@GetUser() user: User2.User, @Body() body: { avatarUrl: string }) {
    return this.authService.updateAvatar(user.id, body.avatarUrl);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  me(@GetUser() user: User2.User) {
    return this.authService.getMe(user.id);
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
  upsertMyPreferences(
    @GetUser() user: User2.User,
    @Body() body: { age?: number; preferredGenres?: string[]; preferredLanguages?: string[] },
  ) {
    return this.authService.updatePreferences(user.id, body);
  }








}
