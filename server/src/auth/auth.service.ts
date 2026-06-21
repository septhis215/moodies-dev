import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from 'src/auth/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { randomBytes, randomInt } from 'node:crypto';
import { RedisService } from 'src/redis/redis.service';
import { sendVerificationCode } from '../utils/mailer';
import { REFRESH_TTL_SECONDS } from './auth.cookies';



@Injectable({})
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private readonly jwt: JwtService,
    private configService: ConfigService,
    private readonly redis: RedisService,
  ) { }

  /** Short-lived access token delivered as an HttpOnly cookie. */
  signAccessToken(payload: { sub: number | string; email?: string }) {
    // expiresIn is a config string ('15m', '1h', …); cast past ms's StringValue
    // template-literal type, which a plain env string can't satisfy.
    const expiresIn = (process.env.JWT_ACCESS_EXPIRES || '15m') as unknown as number;
    return this.jwt.sign(
      { sub: String(payload.sub), ...(payload.email ? { email: payload.email } : {}) },
      { secret: process.env.JWT_SECRET, expiresIn },
    );
  }

  private refreshKey(token: string) {
    return `rt:${token}`;
  }

  /**
   * Mint an opaque refresh token and record it in Redis (token → userId) with a
   * TTL. Opaque + server-stored means it can be revoked (logout) and rotated,
   * unlike a stateless JWT.
   */
  async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.set(this.refreshKey(token), userId, REFRESH_TTL_SECONDS);
    return token;
  }

  /** Issue a fresh access + refresh pair for a freshly authenticated user. */
  async issueTokens(userId: string, email?: string) {
    const accessToken = this.signAccessToken({ sub: userId, email });
    const refreshToken = await this.issueRefreshToken(userId);
    return { accessToken, refreshToken };
  }

  /**
   * Rotate a refresh token: validate it against Redis, delete it (single-use),
   * and issue a new pair. Returns null when the token is unknown/expired — which
   * also covers a replay of an already-rotated token.
   */
  async rotateRefreshToken(oldToken: string) {
    if (!oldToken) return null;
    const userId = await this.redis.get(this.refreshKey(oldToken));
    if (!userId) return null;
    await this.redis.del(this.refreshKey(oldToken));

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) return null;

    const accessToken = this.signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await this.issueRefreshToken(user.id);
    return { userId: user.id, accessToken, refreshToken };
  }

  /** Invalidate a refresh token (logout). */
  async revokeRefreshToken(token: string | undefined): Promise<void> {
    if (token) await this.redis.del(this.refreshKey(token));
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

    const { password, ...result } = user;
    return {
      message: 'User created successfully',
      user: result,
    };
  }

  async signin(dto: LoginDto) {
    // Normalise to match how signup stores emails (lowercased), otherwise a
    // mixed-case login silently fails to find an existing account.
    const user = await this.prismaService.user.findUnique({
      where: {
        email: dto.email.toLowerCase(),
      },
    });

    // Use one generic message for "no such email" and "wrong password" so the
    // endpoint can't be used to enumerate which emails are registered.
    if (!user || !user.password) {
      // A passwordless account is a Google-only account; surface that hint only
      // when the email actually matched, since the account's existence is
      // already implied by the user reaching this screen via Google.
      if (user && !user.password) {
        throw new BadRequestException(
          'This account uses Google sign-in. Use "Continue with Google" or set a password first.'
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    const pwMatches = await argon.verify(user.password, dto.password);
    if (!pwMatches) throw new UnauthorizedException('Invalid email or password');

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
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
    return { user };
  }

  async upsertGoogleUser(profile: any) {
    const { email, name, picture, googleId } = profile;
    return this.upsertGoogleAccount({ email, name, googleId, picture });
  }

  async getAchievementProgress(userId: string) {
    const [
      achievements,
      user,
      moodLogCount,
      distinctMoodRows,
      moodTotal,
      reviewCount,
      watchlist,
      liked,
      quizCount,
      unlockedCount,
      existingProgressRows,
    ] = await Promise.all([
      this.prismaService.achievement.findMany({
        where: { active: true },
        include: { badge: true },
        orderBy: { badge: { displayOrder: 'asc' } },
      }),
      this.prismaService.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          username: true,
          avatarUrl: true,
          preferredGenres: true,
          preferredLanguages: true,
        },
      }),
      this.prismaService.moodLog.count({ where: { userId } }),
      this.prismaService.moodLog.findMany({
        where: { userId },
        select: { moodId: true },
        distinct: ['moodId'],
      }),
      this.prismaService.mood.count({ where: { isActive: true } }),
      this.prismaService.review.count({ where: { userId } }),
      this.prismaService.watchlist.findUnique({ where: { userId } }),
      this.prismaService.likedList.findUnique({ where: { userId } }),
      this.prismaService.quiz.count({ where: { userId } }),
      this.prismaService.userAchievement.count({ where: { userId, unlocked: true } }),
      this.prismaService.userAchievement.findMany({ where: { userId } }),
    ]);

    const distinctMoods = distinctMoodRows.length;
    const savedCount = (watchlist?.movieId.length ?? 0) + (watchlist?.seriesId.length ?? 0);
    const likedCount = (liked?.movieId.length ?? 0) + (liked?.seriesId.length ?? 0);
    const profileBasic = user?.name && user?.username ? 1 : 0;
    const profileStyled =
      user?.avatarUrl && (user.preferredGenres.length > 0 || user.preferredLanguages.length > 0) ? 1 : 0;
    const fullIdentity = profileBasic && profileStyled && quizCount > 0 && moodLogCount > 0 ? 1 : 0;

    const progressFor = (target: string, required: number | null) => {
      switch (target) {
        case 'mood_selections': return moodLogCount;
        case 'distinct_moods': return distinctMoods;
        case 'all_moods': return moodTotal > 0 ? Math.min(distinctMoods, moodTotal) : 0;
        case 'reviews': return reviewCount;
        case 'liked_titles': return likedCount;
        case 'watchlist_titles': return savedCount;
        case 'quizzes': return quizCount;
        case 'profile_basic': return profileBasic;
        case 'profile_stylist': return profileStyled ? 1 : 0;
        case 'full_identity': return fullIdentity ? 1 : 0;
        case 'badges_earned': return unlockedCount;
        default: return 0;
      }
    };

    const existingProgressByAchievement = new Map(
      existingProgressRows.map((progress) => [progress.achievementId, progress])
    );
    const computedRows = achievements.map((achievement) => {
      const required = achievement.requiredCount ?? (achievement.requirementTarget === 'all_moods' ? moodTotal : 1);
      const currentProgress = progressFor(achievement.requirementTarget, required);
      const completionPercentage = required > 0 ? Math.min(100, Math.round((currentProgress / required) * 100)) : 0;
      const shouldUnlock = completionPercentage >= 100;
      const existing = existingProgressByAchievement.get(achievement.id);
      const progress = {
        id: existing?.id,
        userId,
        achievementId: achievement.id,
        currentProgress,
        completionPercentage,
        unlocked: existing?.unlocked || shouldUnlock,
        unlockedAt: existing?.unlockedAt ?? (shouldUnlock ? new Date() : null),
        relatedActivityRef: achievement.requirementTarget,
        createdAt: existing?.createdAt,
        updatedAt: existing?.updatedAt,
      };

      return {
        achievement,
        badge: achievement.badge,
        progress,
        existing,
      };
    });

    const writes = computedRows.flatMap(({ achievement, progress, existing }) => {
      const data = {
        currentProgress: progress.currentProgress,
        completionPercentage: progress.completionPercentage,
        unlocked: progress.unlocked,
        unlockedAt: progress.unlockedAt,
        relatedActivityRef: achievement.requirementTarget,
      };

      if (existing) {
        const unchanged =
          existing.currentProgress === progress.currentProgress &&
          existing.completionPercentage === progress.completionPercentage &&
          existing.unlocked === progress.unlocked &&
          (existing.unlockedAt?.getTime() ?? null) === (progress.unlockedAt?.getTime() ?? null) &&
          existing.relatedActivityRef === achievement.requirementTarget;

        return unchanged
          ? []
          : [this.prismaService.userAchievement.update({
            where: { userId_achievementId: { userId, achievementId: achievement.id } },
            data,
          })];
      }

      return [this.prismaService.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        update: data,
        create: {
          userId,
          achievementId: achievement.id,
          currentProgress: progress.currentProgress,
          completionPercentage: progress.completionPercentage,
          unlocked: progress.unlocked,
          unlockedAt: progress.unlockedAt,
          relatedActivityRef: achievement.requirementTarget,
        },
      })];
    });

    if (writes.length > 0) {
      void this.prismaService.$transaction(writes).catch((error) => {
        console.error('[achievements] Failed to persist achievement progress', error);
      });
    }

    return computedRows.map(({ achievement, badge, progress }) => ({
      achievement,
      badge,
      progress,
    }));
  }

  // ── Password reset (email-code flow) ───────────────────────────────────────

  async requestPasswordReset(email: string) {
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    const user = await this.prismaService.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      // Generic response — never reveal whether the email is registered.
      return { success: true, message: 'If this email exists, a code was sent.' };
    }

    // crypto.randomInt is cryptographically secure; Math.random is predictable
    // and unacceptable for a security token.
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prismaService.emailVerification.create({
      data: { email: normalizedEmail, code, expiresAt },
    });

    // Send in the background — the HTTP response must not block on (or fail
    // because of) SMTP. Errors are logged server-side; the client always gets the
    // generic "if this email exists" reply, so response timing can't reveal
    // whether the account exists, and a slow/broken mailer never hangs the request.
    void sendVerificationCode(normalizedEmail, code).catch((err) => {
      console.error('[auth] Failed to send password-reset email:', err);
    });

    return { success: true, message: 'If this email exists, a code was sent.' };
  }

  async verifyResetCode(email: string, code: string) {
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    // Atomically flip an unused, unexpired code to verified. Doing the match and
    // the write in one statement prevents two concurrent verifies from racing.
    const { count } = await this.prismaService.emailVerification.updateMany({
      where: { email: normalizedEmail, code, verified: false, expiresAt: { gt: new Date() } },
      data: { verified: true },
    });

    if (count > 0) {
      return { success: true, message: 'Email verified. You may now reset password.' };
    }

    // Nothing flipped — figure out why for a helpful message.
    const record = await this.prismaService.emailVerification.findFirst({
      where: { email: normalizedEmail, code },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return { success: false, message: 'Invalid verification code.' };
    if (record.expiresAt < new Date()) return { success: false, message: 'Code expired.' };
    return { success: false, message: 'Code already used.' };
  }

  async resetPassword(email: string, newPassword: string) {
    // Inline body (no DTO) — enforce password strength explicitly.
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 100) {
      throw new BadRequestException('Password must be between 8 and 100 characters');
    }
    const normalizedEmail = String(email ?? '').toLowerCase().trim();
    const hash = await argon.hash(newPassword);

    // Atomically consume the verified token first, so it can't be replayed by a
    // concurrent reset. Only proceed to set the password if we actually consumed one.
    const { count } = await this.prismaService.emailVerification.updateMany({
      where: { email: normalizedEmail, verified: true },
      data: { verified: false },
    });

    if (count === 0) {
      return { success: false, message: 'Email not verified for password reset.' };
    }

    await this.prismaService.user.update({
      where: { email: normalizedEmail },
      data: { password: hash },
    });

    return { success: true, message: 'Password reset successful.' };
  }

  // ── Profile / preferences ──────────────────────────────────────────────────

  async updateProfile(userId: string, body: UpdateProfileDto) {
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
      const existing = await this.prismaService.user.findUnique({
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
      const updated = await this.prismaService.user.update({
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

  async updateAvatar(userId: string, avatarUrl: string) {
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

    return this.prismaService.user.update({
      where: { id: String(userId) },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  async getMe(userId: string) {
    const user = await this.prismaService.user.findUnique({
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

  async updatePreferences(
    userId: string,
    body: { age?: number; preferredGenres?: string[]; preferredLanguages?: string[] },
  ) {
    const { age, preferredGenres, preferredLanguages } = body;

    const data: any = {};
    if (typeof age === 'number') data.age = age;
    if (Array.isArray(preferredGenres)) data.preferredGenres = { set: preferredGenres };
    if (Array.isArray(preferredLanguages)) data.preferredLanguages = { set: preferredLanguages };

    return this.prismaService.user.update({
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
