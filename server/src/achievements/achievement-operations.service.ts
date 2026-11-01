import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { serializableTransaction } from 'src/prisma/serializable-transaction';
import { AchievementCatalogService } from './achievement-catalog.service';
import { validTimezone } from './achievement-rules';

@Injectable()
export class AchievementOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: AchievementCatalogService,
  ) {}
  private audit(actor: string, reason: string) {
    if (
      !actor?.trim() ||
      actor.length > 100 ||
      !reason?.trim() ||
      reason.length > 500
    )
      throw new BadRequestException(
        'An operator identity and reason are required.',
      );
  }

  async status() {
    const [states, oldest] = await Promise.all([
      this.prisma.achievementEvent.groupBy({ by: ['status'], _count: true }),
      this.prisma.achievementEvent.findFirst({
        where: { status: { in: ['pending', 'processing'] } },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      }),
    ]);
    return { states, oldestPendingAt: oldest?.occurredAt || null };
  }
  async inspect(userId: string, key?: string) {
    const where = { userId, ...(key ? { achievement: { key } } : {}) };
    return {
      account: await this.prisma.achievementAccount.findUnique({
        where: { userId },
      }),
      progress: await this.prisma.userAchievement.findMany({
        where,
        include: { achievement: true },
      }),
      awards: await this.prisma.achievementAwardLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      failed: await this.prisma.achievementEvent.findMany({
        where: { userId, status: 'dead' },
        select: {
          id: true,
          kind: true,
          attempts: true,
          errorCode: true,
          occurredAt: true,
        },
        take: 100,
      }),
    };
  }
  async retry(id: string, actor: string, reason: string) {
    this.audit(actor, reason);
    return serializableTransaction(this.prisma, async (tx) => {
      const event = await tx.achievementEvent.findUnique({ where: { id } });
      if (!event) throw new NotFoundException('Event not found.');
      if (event.status !== 'dead')
        throw new BadRequestException(
          'Only failed events can be manually retried.',
        );
      await tx.achievementFact.create({
        data: {
          userId: event.userId,
          metric: 'operator_action',
          key: randomUUID(),
          details: { action: 'retry', eventId: id, actor, reason },
          occurredAt: new Date(),
        },
      });
      return tx.achievementEvent.update({
        where: { id },
        data: {
          status: 'pending',
          attempts: 0,
          availableAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
        },
      });
    });
  }
  async reconcile(after = '', limit = 100, actor: string, reason: string) {
    this.audit(actor, reason);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new BadRequestException('Batch size must be between 1 and 500.');
    const users = await this.prisma.user.findMany({
      where: { id: { gt: after } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    const run = randomUUID();
    for (const user of users)
      await this.prisma.$transaction(async (tx) => {
        await tx.achievementFact.create({
          data: {
            userId: user.id,
            metric: 'operator_action',
            key: `reconcile:${run}`,
            occurredAt: new Date(),
            details: { action: 'reconcile', actor, reason },
          },
        });
        await tx.$queryRaw`SELECT achievement_emit(${user.id},'reconcile',${`reconcile:${run}`},'{"silent":true,"source":"operator-reconciliation"}'::jsonb)`;
      });
    return {
      queued: users.length,
      nextCursor: users.length === limit ? users[users.length - 1].id : null,
    };
  }
  async backfillTitles(
    userId: string,
    after = '',
    limit = 50,
    actor: string,
    reason: string,
  ) {
    this.audit(actor, reason);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('Batch size must be between 1 and 100.');
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; tmdbId: number; type: 'movie' | 'tv'; at: Date }>
    >`
      SELECT key,"tmdbId",type,min(at) AS at FROM (
        SELECT lower("mediaType"::text)||':'||"tmdbId"::text AS key,"tmdbId",CASE WHEN "mediaType"='TV' THEN 'tv' ELSE 'movie' END AS type,"addedAt" AS at FROM watchlist_items WHERE "userId"=${userId}
        UNION ALL SELECT lower("mediaType"::text)||':'||"tmdbId"::text,"tmdbId",CASE WHEN "mediaType"='TV' THEN 'tv' ELSE 'movie' END,"addedAt" FROM liked_items WHERE "userId"=${userId}
        UNION ALL SELECT lower("mediaType"::text)||':'||"tmdbId"::text,"tmdbId",CASE WHEN "mediaType"='TV' THEN 'tv' ELSE 'movie' END,"watchedAt" FROM watched_titles WHERE "userId"=${userId}
      ) engaged WHERE key>${after} GROUP BY key,"tmdbId",type ORDER BY key LIMIT ${limit}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.achievementFact.create({
        data: {
          userId,
          metric: 'operator_action',
          key: randomUUID(),
          occurredAt: new Date(),
          details: {
            action: 'backfill-titles',
            actor,
            reason,
            after,
            queued: rows.length,
          },
        },
      });
      for (const row of rows)
        await tx.$queryRaw`SELECT achievement_emit(${userId},'classify',${`backfill:v1:${row.key}`},${JSON.stringify({ title: { id: row.tmdbId, type: row.type }, silent: true, historical: true, source: 'existing-library' })}::jsonb,${row.at})`;
    });
    return {
      queued: rows.length,
      nextCursor: rows.length === limit ? rows[rows.length - 1].key : null,
    };
  }
  async award(
    action: 'grant' | 'revoke',
    userId: string,
    key: string,
    actor: string,
    reason: string,
    requestId = randomUUID(),
  ) {
    this.audit(actor, reason);
    if (!/^[a-z0-9-]{1,100}$/i.test(requestId))
      throw new BadRequestException(
        'Choose a stable request identifier of at most 100 characters.',
      );
    const definition = (await this.catalogue.published()).find(
      (row) => row.key === key,
    );
    if (!definition) throw new NotFoundException('Achievement not found.');
    return serializableTransaction(this.prisma, async (tx) => {
      await tx.$executeRaw`INSERT INTO achievement_accounts("userId","updatedAt") VALUES(${userId},now()) ON CONFLICT DO NOTHING`;
      await tx.$queryRaw`SELECT "userId" FROM achievement_accounts WHERE "userId"=${userId} FOR UPDATE`;
      const repeated = await tx.achievementAwardLog.findUnique({
        where: { idempotencyKey: `operator:${requestId}` },
      });
      if (repeated) {
        if (
          repeated.userId !== userId ||
          repeated.achievementId !== definition.id ||
          repeated.action !== action
        )
          throw new BadRequestException(
            'This request identifier already belongs to another operation.',
          );
        return repeated;
      }
      const previous = await tx.userAchievement.findUnique({
        where: {
          userId_achievementId: { userId, achievementId: definition.id },
        },
      });
      if (action === 'grant' && previous?.unlocked) return { unchanged: true };
      const required =
        definition.requiredCount ??
        (definition.requirementTarget === 'all_moods'
          ? await tx.mood.count({ where: { isActive: true } })
          : 1);
      if (required < 1)
        throw new BadRequestException(
          'This achievement has no active earning requirement yet.',
        );
      if (action === 'revoke')
        await tx.achievementFact.upsert({
          where: {
            userId_metric_key: {
              userId,
              metric: 'revoked',
              key: definition.id,
            },
          },
          create: {
            userId,
            metric: 'revoked',
            key: definition.id,
            occurredAt: new Date(),
            details: { actor, reason },
          },
          update: {},
        });
      else
        await tx.achievementFact.deleteMany({
          where: { userId, metric: 'revoked', key: definition.id },
        });
      const data = {
        unlocked: action === 'grant',
        unlockedAt: action === 'grant' ? new Date() : null,
        currentProgress: action === 'grant' ? required : 0,
        completionPercentage: action === 'grant' ? 100 : 0,
        ruleVersion: definition.ruleVersion,
      };
      await tx.userAchievement.upsert({
        where: {
          userId_achievementId: { userId, achievementId: definition.id },
        },
        create: { userId, achievementId: definition.id, ...data },
        update: data,
      });
      const award = await tx.achievementAwardLog.create({
        data: {
          userId,
          achievementId: definition.id,
          ruleVersion: definition.ruleVersion,
          action,
          actor,
          reason,
          evidence: { basis: 'operator', required },
          idempotencyKey: `operator:${requestId}`,
        },
      });
      await tx.achievementNotification.create({
        data: { userId, awardId: award.id },
      });
      await tx.achievementAccount.update({
        where: { userId },
        data: { revision: { increment: 1 } },
      });
      await tx.$queryRaw`SELECT achievement_emit(${userId},'reconcile',${`operator-award:${requestId}`},'{"source":"operator-award"}'::jsonb)`;
      return award;
    });
  }
  async timezone(userId: string, zone: string, actor: string, reason: string) {
    this.audit(actor, reason);
    const timezone = validTimezone(zone);
    return serializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM achievement_accounts WHERE "userId"=${userId} FOR UPDATE`;
      const previous = await tx.achievementAccount.findUniqueOrThrow({
        where: { userId },
      });
      await tx.achievementFact.create({
        data: {
          userId,
          metric: 'operator_action',
          key: randomUUID(),
          occurredAt: new Date(),
          details: {
            action: 'timezone',
            previous: previous.timezone,
            timezone,
            actor,
            reason,
          },
        },
      });
      return tx.achievementAccount.update({
        where: { userId },
        data: { timezone },
      });
    });
  }
}
