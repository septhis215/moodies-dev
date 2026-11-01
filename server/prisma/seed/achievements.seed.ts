import type { PrismaClient } from '@prisma/client';
import {
  achievementSeeds,
  rarityTheme,
} from '../../src/achievements/achievement-catalog';
import {
  ACHIEVEMENT_RULE_VERSION,
  DISCOVERY_POLICY,
  QUIZ_TYPES,
} from '../../src/achievements/achievement-rules';
import { isDeepStrictEqual } from 'node:util';

export async function seedAchievements(prisma: PrismaClient) {
  await prisma.$transaction(
    async (tx) => {
      for (const [index, seed] of achievementSeeds.entries()) {
        const achievement = await tx.achievement.upsert({
          where: { key: seed.key },
          update: {
            title: seed.title,
            description: seed.description,
            category: seed.category,
            requirementType: seed.requirementType,
            requirementTarget: seed.requirementTarget,
            requiredCount: seed.requiredCount,
            progressLogic: seed.progressLogic,
            reasoningTemplate: seed.reasoningTemplate,
            lockedHint: seed.lockedHint,
            active: true,
            ruleVersion: ACHIEVEMENT_RULE_VERSION,
          },
          create: {
            key: seed.key,
            title: seed.title,
            description: seed.description,
            category: seed.category,
            requirementType: seed.requirementType,
            requirementTarget: seed.requirementTarget,
            requiredCount: seed.requiredCount,
            progressLogic: seed.progressLogic,
            reasoningTemplate: seed.reasoningTemplate,
            lockedHint: seed.lockedHint,
            active: true,
            ruleVersion: ACHIEVEMENT_RULE_VERSION,
          },
        });

        const definition = {
          ...seed,
          version: ACHIEVEMENT_RULE_VERSION,
          discoveryPolicy: DISCOVERY_POLICY,
          quizTypes: [...QUIZ_TYPES],
        };
        const published = await tx.achievementRuleVersion.findUnique({
          where: {
            achievementId_version: {
              achievementId: achievement.id,
              version: ACHIEVEMENT_RULE_VERSION,
            },
          },
        });
        if (published && !isDeepStrictEqual(published.definition, definition))
          throw new Error(
            `Published rule changed without a new version: ${seed.key}`,
          );
        if (!published)
          await tx.achievementRuleVersion.create({
            data: {
              achievementId: achievement.id,
              version: ACHIEVEMENT_RULE_VERSION,
              target: seed.requirementTarget,
              requiredCount: seed.requiredCount,
              definition,
            },
          });

        const theme = rarityTheme[seed.rarity] ?? rarityTheme.Common;
        await tx.badgeDefinition.upsert({
          where: { key: seed.badgeKey },
          update: {
            achievementId: achievement.id,
            badgeName: seed.badgeName,
            icon: seed.icon,
            rarity: seed.rarity,
            mascotMood: seed.mascotMood,
            mascotMotion: seed.mascotMotion,
            colorTheme: theme,
            lockedVisualState: {
              opacity: 0.45,
              treatment: 'muted',
              border: 'white/10',
            },
            unlockedVisualState: {
              glow: theme.glow,
              accent: theme.accent,
              treatment: 'reward',
            },
            displayOrder: index + 1,
            active: true,
          },
          create: {
            key: seed.badgeKey,
            achievementId: achievement.id,
            badgeName: seed.badgeName,
            icon: seed.icon,
            rarity: seed.rarity,
            mascotMood: seed.mascotMood,
            mascotMotion: seed.mascotMotion,
            colorTheme: theme,
            lockedVisualState: {
              opacity: 0.45,
              treatment: 'muted',
              border: 'white/10',
            },
            unlockedVisualState: {
              glow: theme.glow,
              accent: theme.accent,
              treatment: 'reward',
            },
            displayOrder: index + 1,
            active: true,
          },
        });
      }
    },
    { timeout: 60000 },
  );
}
