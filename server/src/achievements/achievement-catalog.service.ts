import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { achievementSeeds } from './achievement-catalog';
import {
  ACHIEVEMENT_RULE_VERSION,
  DISCOVERY_POLICY,
  QUIZ_TYPES,
  RULE_TARGETS,
  type RuleTarget,
} from './achievement-rules';

@Injectable()
export class AchievementCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async published() {
    const rows = await this.prisma.achievement.findMany({
      where: { active: true },
      include: { badge: true, ruleVersions: true },
      orderBy: { badge: { displayOrder: 'asc' } },
    });
    if (!rows.length)
      throw new ServiceUnavailableException(
        'The achievement catalogue has not been published.',
      );
    const known = new Map(achievementSeeds.map((seed) => [seed.key, seed]));
    for (const row of rows) {
      const rule = row.ruleVersions.find(
        (version) => version.version === row.ruleVersion,
      );
      const expected = known.get(row.key);
      const definition = rule?.definition as
        | Record<string, unknown>
        | undefined;
      if (
        !expected ||
        !rule ||
        row.ruleVersion !== ACHIEVEMENT_RULE_VERSION ||
        !RULE_TARGETS.includes(rule.target as RuleTarget) ||
        rule.target !== expected.requirementTarget ||
        row.requirementTarget !== rule.target ||
        row.requiredCount !== rule.requiredCount ||
        rule.requiredCount !== expected.requiredCount ||
        row.requirementType !== expected.requirementType ||
        !isDeepStrictEqual(definition?.discoveryPolicy, DISCOVERY_POLICY) ||
        !isDeepStrictEqual(definition?.quizTypes, [...QUIZ_TYPES])
      ) {
        throw new ServiceUnavailableException(
          'The achievement catalogue needs an operator review.',
        );
      }
    }
    return rows;
  }

  async getMe(userId: string) {
    const account = await this.prisma.achievementAccount.findUnique({
      where: { userId },
    });
    return this.redis.getOrSet(
      `achievements:v2:${userId}:${account?.revision ?? 0}`,
      30,
      async () => {
        const [catalogue, progressRows, awards, activeMoods, revoked, events] =
          await Promise.all([
            this.published(),
            this.prisma.userAchievement.findMany({ where: { userId } }),
            this.prisma.achievementAwardLog.findMany({
              where: { userId, action: { in: ['grant', 'legacy'] } },
              orderBy: { createdAt: 'desc' },
            }),
            this.prisma.mood.count({ where: { isActive: true } }),
            this.prisma.achievementFact.findMany({
              where: { userId, metric: 'revoked' },
              select: { key: true },
            }),
            this.prisma.achievementEvent.groupBy({
              by: ['status'],
              _count: true,
              where: {
                userId,
                status: { in: ['pending', 'processing', 'dead'] },
              },
            }),
          ]);
        const progressById = new Map(
          progressRows.map((row) => [row.achievementId, row]),
        );
        const blocked = new Set(revoked.map((fact) => fact.key));
        const achievements = catalogue
          .filter(
            (row) =>
              row.badge?.active &&
              (row.requirementTarget !== 'all_moods' || activeMoods > 0),
          )
          .map((row) => {
            const existing = progressById.get(row.id);
            const award = awards.find((item) => item.achievementId === row.id);
            const version = existing?.unlocked
              ? existing.ruleVersion
              : row.ruleVersion;
            const snapshot = row.ruleVersions.find(
              (rule) => rule.version === version,
            );
            const definition = snapshot?.definition as
              | Record<string, unknown>
              | undefined;
            const evidence = award?.evidence as
              | Record<string, unknown>
              | undefined;
            const required =
              existing?.unlocked && typeof evidence?.required === 'number'
                ? evidence.required
                : (snapshot?.requiredCount ??
                  (row.requirementTarget === 'all_moods'
                    ? activeMoods
                    : QUIZ_TYPES.length));
            const unlocked = !!existing?.unlocked;
            return {
              achievement: {
                id: row.id,
                key: row.key,
                title:
                  unlocked && typeof definition?.title === 'string'
                    ? definition.title
                    : row.title,
                description: row.description,
                category: row.category,
                requirementType: row.requirementType,
                requirementTarget: row.requirementTarget,
                requiredCount: required,
                progressLogic: row.progressLogic,
                reasoningTemplate: row.reasoningTemplate,
                lockedHint: row.lockedHint,
                active: row.active,
                ruleVersion: version,
              },
              badge: row.badge,
              progress: {
                currentProgress: unlocked
                  ? Math.max(required, existing?.currentProgress || 0)
                  : existing?.currentProgress || 0,
                completionPercentage: unlocked
                  ? 100
                  : existing?.completionPercentage || 0,
                unlocked,
                unlockedAt: existing?.unlockedAt || null,
                revoked: blocked.has(row.id),
              },
            };
          });
        return {
          status: 'ready',
          revision: account?.revision || 0,
          pending: events.some(
            (event) => event.status !== 'dead' && event._count > 0,
          ),
          delayed: events.some(
            (event) => event.status === 'dead' && event._count > 0,
          ),
          achievements,
          unlockedCount: achievements.filter((row) => row.progress.unlocked)
            .length,
          totalCount: achievements.length,
        };
      },
    );
  }
}
