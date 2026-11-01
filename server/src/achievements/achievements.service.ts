import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaType, Prisma } from '@prisma/client';
import {
  randomUUID,
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { serializableTransaction } from 'src/prisma/serializable-transaction';
import { AchievementCatalogService } from './achievement-catalog.service';
import { AchievementEvidenceService } from './achievement-evidence.service';
import { calendarKeys, validTimezone, QUIZ_VERSION } from './achievement-rules';
import type { AchievementActivityDto } from './achievements.dto';
import type { QuizAnswer } from 'src/quiz/quiz-ranking';
import { GENRES } from 'src/quiz/quiz-ranking';

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: AchievementCatalogService,
    private readonly evidence: AchievementEvidenceService,
    private readonly config: ConfigService,
  ) {}
  get enabled() {
    return this.config.get<string>('ACHIEVEMENTS_ENABLED') === 'true';
  }
  private requireEnabled() {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'Achievements are not available yet.',
      );
  }
  getMe(userId: string) {
    return this.enabled
      ? this.catalogue.getMe(userId)
      : Promise.resolve({
          status: 'disabled',
          achievements: [],
          totalCount: 0,
          unlockedCount: 0,
          pending: false,
          revision: 0,
        });
  }

  private async account(
    tx: Prisma.TransactionClient,
    userId: string,
    timezone?: string,
  ) {
    let zone: string | undefined;
    try {
      zone = validTimezone(timezone || 'UTC');
    } catch {
      throw new BadRequestException('Choose a valid timezone.');
    }
    await tx.$executeRaw`INSERT INTO achievement_accounts("userId","updatedAt") VALUES(${userId},now()) ON CONFLICT DO NOTHING`;
    await tx.$queryRaw`SELECT "userId" FROM achievement_accounts WHERE "userId"=${userId} FOR UPDATE`;
    if (zone)
      await tx.achievementAccount.updateMany({
        where: { userId, timezone: null },
        data: { timezone: zone },
      });
    return tx.achievementAccount.findUniqueOrThrow({ where: { userId } });
  }
  private emit(
    tx: Prisma.TransactionClient,
    userId: string,
    kind: string,
    key: string,
    payload: Prisma.InputJsonObject,
    at: Date,
  ) {
    return tx.$queryRaw`SELECT achievement_emit(${userId},${kind},${key},${JSON.stringify(payload)}::jsonb,${at})`;
  }

  async activity(userId: string, activity: AchievementActivityDto) {
    this.requireEnabled();
    if (activity.kind === 'detail') {
      if (!activity.tmdbId || !activity.type)
        throw new BadRequestException('Choose a title.');
      const title = await this.evidence.title(activity.type, activity.tmdbId);
      if (title.adult)
        throw new BadRequestException('This title does not qualify.');
    } else if (activity.kind === 'mood' && !activity.moodId)
      throw new BadRequestException('Choose a mood.');
    return serializableTransaction(this.prisma, async (tx) => {
      const account = await this.account(tx, userId, activity.timezone);
      const at = new Date();
      const keys = calendarKeys(at, account.timezone || 'UTC');
      if (activity.kind === 'visit') {
        await this.emit(
          tx,
          userId,
          'reconcile',
          'bootstrap:v1',
          { silent: true, source: 'existing-account' },
          at,
        );
        await this.emit(
          tx,
          userId,
          'visit',
          `visit:${keys.date}:${keys.night || 'day'}`,
          { timezone: account.timezone || 'UTC' },
          at,
        );
      } else if (activity.kind === 'detail') {
        const key = `detail:${activity.type}:${activity.tmdbId}`;
        const existing = await tx.achievementEvent.findUnique({
          where: { userId_key: { userId, key } },
        });
        if (!existing) {
          const recent = await tx.achievementEvent.count({
            where: {
              userId,
              kind: 'detail',
              occurredAt: { gt: new Date(at.getTime() - 5000) },
            },
          });
          if (recent)
            throw new HttpException(
              'Please wait before recording another title.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          await this.emit(
            tx,
            userId,
            'detail',
            key,
            { title: { id: activity.tmdbId!, type: activity.type! } },
            at,
          );
        }
      } else if (activity.kind === 'mood') {
        const mood = await tx.mood.findFirst({
          where: { id: activity.moodId!, isActive: true },
          select: { id: true },
        });
        if (!mood) throw new BadRequestException('This mood is not available.');
        const fact = await tx.achievementFact.createMany({
          data: [
            {
              userId,
              metric: 'mood_logged',
              key: `${keys.date}:${mood.id}`,
              day: keys.date,
              occurredAt: at,
            },
          ],
          skipDuplicates: true,
        });
        if (fact.count)
          await tx.moodLog.create({
            data: { userId, moodId: mood.id, intensity: 5, tags: [] },
          });
      }
      return { accepted: true };
    });
  }

  async watched(userId: string, type: 'movie' | 'tv', id: number) {
    if (!this.enabled) return { enabled: false, watched: false };
    const row = await this.prisma.watchedTitle.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId: id,
          mediaType: type === 'movie' ? MediaType.MOVIE : MediaType.TV,
        },
      },
    });
    return { enabled: true, watched: !!row, watchedAt: row?.watchedAt || null };
  }
  async setWatched(
    userId: string,
    type: 'movie' | 'tv',
    id: number,
    active: boolean,
  ) {
    this.requireEnabled();
    if (active && (await this.evidence.title(type, id)).adult)
      throw new BadRequestException('This title does not qualify.');
    const mediaType = type === 'movie' ? MediaType.MOVIE : MediaType.TV;
    await serializableTransaction(this.prisma, async (tx) => {
      if (active)
        await tx.watchedTitle.upsert({
          where: { userId_tmdbId_mediaType: { userId, tmdbId: id, mediaType } },
          create: { userId, tmdbId: id, mediaType },
          update: {},
        });
      else
        await tx.watchedTitle.deleteMany({
          where: { userId, tmdbId: id, mediaType },
        });
    });
    return this.watched(userId, type, id);
  }

  private quizHash(answers: QuizAnswer[], attemptId: string, version: string) {
    const categories = ['feeling', 'pace', 'genre', 'format', 'commitment'];
    if (
      version !== QUIZ_VERSION ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        attemptId,
      ) ||
      !Array.isArray(answers) ||
      answers.length !== categories.length ||
      new Set(answers.map((answer) => answer?.category)).size !==
        categories.length ||
      answers.some(
        (answer) =>
          !answer ||
          !categories.includes(answer.category || '') ||
          !Array.isArray(answer.genres) ||
          answer.genres.length > 20 ||
          answer.genres.some(
            (genre) =>
              typeof genre !== 'string' || !Object.hasOwn(GENRES, genre),
          ) ||
          typeof answer.mood !== 'string' ||
          answer.mood.length > 50 ||
          (answer.category === 'feeling' && !answer.mood) ||
          (answer.category === 'genre' && !answer.genres.length) ||
          (answer.category === 'pace' &&
            !['slow', 'balanced', 'fast'].includes(answer.pace || '')) ||
          (answer.category === 'format' &&
            !['movie', 'tv', 'mixed'].includes(answer.mediaType || '')) ||
          (answer.category === 'commitment' &&
            !['short', 'standard', 'open'].includes(answer.commitment || '')),
      )
    )
      throw new BadRequestException(
        'Complete the current quiz to record progress.',
      );
    return createHash('sha256')
      .update(
        JSON.stringify({
          attemptId,
          version,
          answers: answers.map((answer) => ({
            category: answer.category,
            genres: [...new Set(answer.genres)].sort(),
            mood: answer.mood,
            mediaType: answer.mediaType || null,
            pace: answer.pace || null,
            commitment: answer.commitment || null,
          })),
        }),
      )
      .digest('hex');
  }
  private receiptSignature(payload: string) {
    const key = this.config.get<string>('JWT_SECRET');
    if (!key || key.length < 16)
      throw new ServiceUnavailableException(
        'Quiz completion is temporarily unavailable.',
      );
    return createHmac('sha256', key)
      .update(`moodies.quiz-completion.${payload}`)
      .digest('hex');
  }
  createQuizReceipt(answers: QuizAnswer[], attemptId: string, version: string) {
    const hash = this.quizHash(answers, attemptId, version);
    const payload = Buffer.from(
      JSON.stringify({ hash, expiresAt: Date.now() + 15 * 60000 }),
    ).toString('base64url');
    return `${payload}.${this.receiptSignature(payload)}`;
  }
  async recordQuiz(
    userId: string,
    answers: QuizAnswer[],
    attemptId: string,
    version: string,
    receipt: string,
    timezone?: string,
  ) {
    if (!this.enabled) return { counted: false };
    const hash = this.quizHash(answers, attemptId, version);
    const [payload, signature, extra] =
      typeof receipt === 'string' ? receipt.split('.') : [];
    if (
      !payload ||
      !signature ||
      extra ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      payload.length > 1024 ||
      !timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(this.receiptSignature(payload), 'hex'),
      )
    )
      throw new BadRequestException(
        'Request fresh quiz results before saving progress.',
      );
    let claim: { hash?: string; expiresAt?: number };
    try {
      claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid quiz completion receipt.');
    }
    if (
      claim.hash !== hash ||
      typeof claim.expiresAt !== 'number' ||
      claim.expiresAt < Date.now()
    )
      throw new BadRequestException(
        'Request fresh quiz results before saving progress.',
      );
    return serializableTransaction(this.prisma, async (tx) => {
      const account = await this.account(tx, userId, timezone);
      const at = new Date();
      const day = calendarKeys(at, account.timezone || 'UTC').date;
      const existing = await tx.quizCompletion.findFirst({
        where: {
          userId,
          OR: [{ attemptId }, { quizType: 'signal-reel', completedDay: day }],
        },
      });
      if (existing) return { counted: false };
      const quiz = await tx.quiz.create({
        data: {
          userId,
          answers: answers.map((answer) => ({ ...answer })),
          resultMood:
            answers.find((answer) => answer.category === 'feeling')?.mood ||
            'mixed',
        },
      });
      await tx.quizCompletion.create({
        data: {
          userId,
          quizId: quiz.id,
          attemptId,
          quizType: 'signal-reel',
          version,
          completedDay: day,
        },
      });
      return { counted: true };
    });
  }

  async claimNotifications(userId: string) {
    if (!this.enabled)
      return { enabled: false, token: null, notifications: [] };
    const token = randomUUID();
    const claimed = await this.prisma.$queryRaw<
      Array<{ id: string }>
    >`WITH selected AS (
      SELECT id FROM achievement_notifications WHERE "userId"=${userId} AND "seenAt" IS NULL AND ("leaseUntil" IS NULL OR "leaseUntil"<now())
      ORDER BY "createdAt",id LIMIT 3 FOR UPDATE SKIP LOCKED
    ) UPDATE achievement_notifications n SET "leaseToken"=${token},"leaseUntil"=now()+interval '1 minute' FROM selected s WHERE n.id=s.id RETURNING n.id`;
    const rows = await this.prisma.achievementNotification.findMany({
      where: { userId, id: { in: claimed.map((row) => row.id) } },
      include: {
        award: { include: { achievement: { include: { badge: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      enabled: true,
      token,
      notifications: rows.map((row) => ({
        id: row.id,
        achievementKey: row.award.achievement.key,
        title:
          row.award.achievement.badge?.badgeName || row.award.achievement.title,
        description:
          row.award.action === 'revoke'
            ? 'This badge was withdrawn after a review.'
            : row.award.achievement.description,
        action: row.award.action,
        earnedAt: row.award.createdAt,
      })),
    };
  }
  async acknowledge(userId: string, id: string, token: string) {
    this.requireEnabled();
    const result = await this.prisma.achievementNotification.updateMany({
      where: {
        id,
        userId,
        leaseToken: token,
        seenAt: null,
        leaseUntil: { gt: new Date() },
      },
      data: { seenAt: new Date(), leaseToken: null, leaseUntil: null },
    });
    return { acknowledged: result.count === 1 };
  }
}
