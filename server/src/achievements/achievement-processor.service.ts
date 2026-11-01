import { Injectable } from '@nestjs/common';
import { Prisma, type AchievementEvent } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { serializableTransaction } from 'src/prisma/serializable-transaction';
import { AchievementCatalogService } from './achievement-catalog.service';
import { AchievementEvidenceService } from './achievement-evidence.service';
import {
  DISCOVERY_POLICY,
  QUIZ_TYPES,
  RULE_TARGETS,
  evaluateProgress,
  calendarKeys,
  longestStreak,
  type RuleTarget,
} from './achievement-rules';

type Metrics = Partial<Record<RuleTarget, number>>;
type EventBody = {
  metrics?: Metrics;
  required?: Metrics;
  title?: { id: number; type: 'movie' | 'tv' };
  source?: string;
  silent?: boolean;
  ruleVersion?: number;
  historical?: boolean;
  timezone?: string;
};
type Fact = {
  metric: string;
  key: string;
  day?: string;
  details?: Prisma.InputJsonObject;
};

@Injectable()
export class AchievementProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: AchievementCatalogService,
    private readonly evidence: AchievementEvidenceService,
  ) {}

  async process(event: AchievementEvent, token: string) {
    const body = event.payload as EventBody;
    if (body.ruleVersion !== 1)
      throw new Error('Unsupported achievement rule version');
    const definitions = await this.catalogue.published();
    const classification =
      event.kind === 'classify' && body.title
        ? await this.evidence.classifications(
            body.title.type,
            body.title.id,
            event.occurredAt,
          )
        : null;
    await serializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM achievement_accounts WHERE "userId"=${event.userId} FOR UPDATE`;
      const current = await tx.achievementEvent.findUnique({
        where: { id: event.id },
      });
      if (
        current?.status !== 'processing' ||
        current.leaseToken !== token ||
        !current.leaseUntil ||
        current.leaseUntil < new Date()
      )
        return;
      const account = await tx.achievementAccount.findUniqueOrThrow({
        where: { userId: event.userId },
      });
      let metrics: Metrics = { ...body.metrics };
      const required: Metrics = {
        all_quiz_types: QUIZ_TYPES.length,
        ...body.required,
      };
      const facts: Fact[] = [];
      if (event.kind === 'visit') {
        const keys = calendarKeys(
          event.occurredAt,
          body.timezone || account.timezone || 'UTC',
        );
        facts.push({ metric: 'visit_days', key: keys.date, day: keys.date });
        if (keys.night)
          facts.push({
            metric: 'late_night_sessions',
            key: keys.night,
            day: keys.night,
          });
      } else if (event.kind === 'detail' && body.title) {
        facts.push({
          metric: 'detail_views',
          key: `${body.title.type}:${body.title.id}`,
        });
      } else if (classification && body.title) {
        for (const metric of classification.metrics.filter(
          (metric) => !body.historical || metric !== 'trending_titles',
        ))
          facts.push({
            metric,
            key: `${body.title.type}:${body.title.id}`,
            details: {
              title: { ...classification.title },
              policy: { ...DISCOVERY_POLICY },
              trendSnapshotId: classification.trendSnapshotId,
            },
          });
      } else if (event.kind === 'reconcile') {
        const snapshots = await tx.$queryRaw<
          Array<{ metrics: Metrics }>
        >`SELECT achievement_metrics(${event.userId},'all') AS metrics`;
        metrics = snapshots[0].metrics;
        required.all_moods = await tx.mood.count({ where: { isActive: true } });
      } else if (event.kind !== 'metrics') {
        throw new Error('Unsupported achievement event');
      }
      for (const fact of facts)
        await tx.achievementFact.createMany({
          data: [
            {
              ...fact,
              userId: event.userId,
              occurredAt: event.occurredAt,
              sourceEventId: event.id,
            },
          ],
          skipDuplicates: true,
        });
      for (const metric of new Set(facts.map((fact) => fact.metric))) {
        if (metric === 'visit_days') {
          const days = await tx.achievementFact.findMany({
            where: { userId: event.userId, metric },
            select: { day: true },
            orderBy: { day: 'desc' },
            take: 400,
          });
          metrics.visit_days = longestStreak(
            days.flatMap((fact) => (fact.day ? [fact.day] : [])),
          );
        } else
          metrics[metric as RuleTarget] = await tx.achievementFact.count({
            where: { userId: event.userId, metric },
          });
      }
      for (const [metric, value] of Object.entries(metrics)) {
        if (
          !RULE_TARGETS.includes(metric as RuleTarget) ||
          !Number.isSafeInteger(value) ||
          value! < 0 ||
          value! > 2147483647
        )
          throw new Error('Invalid achievement metric');
      }
      const counters = new Map(
        (
          await tx.achievementMetric.findMany({
            where: { userId: event.userId },
          })
        ).map((counter) => [counter.metric, counter]),
      );
      const live: Metrics = {};
      for (const [metric, value] of Object.entries(metrics)) {
        const previous = counters.get(metric);
        const fromFacts = facts.some((fact) => fact.metric === metric);
        const accepted =
          fromFacts || !previous || event.sequence >= previous.lastSequence;
        live[metric as RuleTarget] = accepted ? value : previous!.value;
        if (accepted)
          await tx.achievementMetric.upsert({
            where: { userId_metric: { userId: event.userId, metric } },
            create: {
              userId: event.userId,
              metric,
              value: value!,
              lastSequence: event.sequence,
            },
            update: {
              value: value!,
              lastSequence:
                previous && previous.lastSequence > event.sequence
                  ? previous.lastSequence
                  : event.sequence,
            },
          });
      }
      const suppressed = new Set(
        (
          await tx.achievementFact.findMany({
            where: { userId: event.userId, metric: 'revoked' },
            select: { key: true },
          })
        ).map((fact) => fact.key),
      );
      const existing = new Map(
        (
          await tx.userAchievement.findMany({ where: { userId: event.userId } })
        ).map((row) => [row.achievementId, row]),
      );
      // Dependency milestones evaluate after ordinary awards in the same transaction.
      for (const definition of [
        ...definitions.filter(
          (row) => row.requirementTarget !== 'badges_earned',
        ),
        ...definitions.filter(
          (row) => row.requirementTarget === 'badges_earned',
        ),
      ]) {
        const target = definition.requirementTarget as RuleTarget;
        if (target === 'badges_earned')
          metrics.badges_earned = await tx.userAchievement.count({
            where: {
              userId: event.userId,
              unlocked: true,
              achievementId: { not: definition.id },
              achievement: { badge: { isNot: null } },
            },
          });
        const value = metrics[target];
        const threshold = definition.requiredCount ?? required[target];
        if (
          value === undefined ||
          !threshold ||
          threshold < 1 ||
          suppressed.has(definition.id)
        )
          continue;
        const previous = existing.get(definition.id);
        if (previous?.unlocked) continue;
        const qualifies = Math.max(value, live[target] || 0) >= threshold;
        const progress = evaluateProgress(
          qualifies
            ? Math.max(value, live[target] || 0)
            : (live[target] ?? value),
          threshold,
          false,
        );
        if (
          !previous ||
          previous.currentProgress !== progress.currentProgress ||
          previous.completionPercentage !== progress.completionPercentage ||
          previous.unlocked !== progress.unlocked
        ) {
          const data = {
            ...progress,
            ruleVersion: previous?.unlocked
              ? previous.ruleVersion
              : definition.ruleVersion,
            unlockedAt:
              previous?.unlockedAt ||
              (progress.unlocked
                ? event.kind === 'reconcile'
                  ? new Date()
                  : event.occurredAt
                : null),
            relatedActivityRef: target,
          };
          await tx.userAchievement.upsert({
            where: {
              userId_achievementId: {
                userId: event.userId,
                achievementId: definition.id,
              },
            },
            create: {
              userId: event.userId,
              achievementId: definition.id,
              ...data,
            },
            update: data,
          });
        }
        if (progress.unlocked && !previous?.unlocked) {
          const award = await tx.achievementAwardLog.create({
            data: {
              userId: event.userId,
              achievementId: definition.id,
              ruleVersion: definition.ruleVersion,
              action: 'grant',
              actor: 'achievement-worker',
              reason: definition.reasoningTemplate,
              evidence: {
                value,
                required: threshold,
                target,
                ruleVersion: definition.ruleVersion,
                source: body.source || event.kind,
                basis:
                  event.kind === 'reconcile' || body.historical
                    ? 'reconstructed'
                    : 'recorded',
              },
              sourceEventId: event.id,
              idempotencyKey: `grant:${event.userId}:${definition.id}:${definition.ruleVersion}`,
            },
          });
          if (!body.silent)
            await tx.achievementNotification.create({
              data: { userId: event.userId, awardId: award.id },
            });
        }
      }
      if (event.kind === 'metrics' && body.title)
        await tx.$queryRaw`SELECT achievement_emit(${event.userId},'classify',${`classify:${event.id}`},${JSON.stringify({ title: body.title, source: body.source, silent: body.silent || false, ruleVersion: body.ruleVersion })}::jsonb,${event.occurredAt})`;
      await tx.achievementEvent.update({
        where: { id: event.id },
        data: {
          status: 'completed',
          processedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
          errorCode: null,
        },
      });
      await tx.achievementAccount.update({
        where: { userId: event.userId },
        data: {
          projectedSequence:
            event.sequence > account.projectedSequence
              ? event.sequence
              : account.projectedSequence,
          revision: { increment: 1 },
        },
      });
    });
  }
}
