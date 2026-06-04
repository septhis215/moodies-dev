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

  async getAchievementProgress(userId: string) {
    const [
      achievements,
      user,
      moodLogs,
      moodTotal,
      reviewCount,
      watchlist,
      liked,
      quizCount,
      unlockedCount,
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
      this.prismaService.moodLog.findMany({
        where: { userId },
        select: { moodId: true },
      }),
      this.prismaService.mood.count({ where: { isActive: true } }),
      this.prismaService.review.count({ where: { userId } }),
      this.prismaService.watchlist.findUnique({ where: { userId } }),
      this.prismaService.likedList.findUnique({ where: { userId } }),
      this.prismaService.quiz.count({ where: { userId } }),
      this.prismaService.userAchievement.count({ where: { userId, unlocked: true } }),
    ]);

    const distinctMoods = new Set(moodLogs.map((log) => log.moodId)).size;
    const savedCount = (watchlist?.movieId.length ?? 0) + (watchlist?.seriesId.length ?? 0);
    const likedCount = (liked?.movieId.length ?? 0) + (liked?.seriesId.length ?? 0);
    const profileBasic = user?.name && user?.username ? 1 : 0;
    const profileStyled =
      user?.avatarUrl && (user.preferredGenres.length > 0 || user.preferredLanguages.length > 0) ? 1 : 0;
    const fullIdentity = profileBasic && profileStyled && quizCount > 0 && moodLogs.length > 0 ? 1 : 0;

    const progressFor = (target: string, required: number | null) => {
      switch (target) {
        case 'mood_selections': return moodLogs.length;
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

    const rows: Array<{ achievement: any; badge: any; progress: any }> = [];
    for (const achievement of achievements) {
      const required = achievement.requiredCount ?? (achievement.requirementTarget === 'all_moods' ? moodTotal : 1);
      const currentProgress = progressFor(achievement.requirementTarget, required);
      const completionPercentage = required > 0 ? Math.min(100, Math.round((currentProgress / required) * 100)) : 0;
      const shouldUnlock = completionPercentage >= 100;
      const existing = await this.prismaService.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });
      const progress = await this.prismaService.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        update: {
          currentProgress,
          completionPercentage,
          unlocked: existing?.unlocked || shouldUnlock,
          unlockedAt: existing?.unlockedAt ?? (shouldUnlock ? new Date() : null),
          relatedActivityRef: achievement.requirementTarget,
        },
        create: {
          userId,
          achievementId: achievement.id,
          currentProgress,
          completionPercentage,
          unlocked: shouldUnlock,
          unlockedAt: shouldUnlock ? new Date() : null,
          relatedActivityRef: achievement.requirementTarget,
        },
      });
      rows.push({
        achievement,
        badge: achievement.badge,
        progress,
      });
    }

    return rows;
  }

}
