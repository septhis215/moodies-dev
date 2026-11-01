export interface AchievementRow {
  achievement: {
    id: string;
    key: string;
    title: string;
    description: string;
    category: string;
    requirementType: string;
    requirementTarget: string;
    requiredCount: number;
    reasoningTemplate: string;
    lockedHint: string;
    ruleVersion: number;
  };
  badge: {
    badgeName: string;
    icon: string;
    rarity: string;
    mascotMood: string;
    mascotMotion: string;
    colorTheme?: { accent?: string; glow?: string };
    displayOrder: number;
  } | null;
  progress: {
    currentProgress: number;
    completionPercentage: number;
    unlocked: boolean;
    unlockedAt?: string | null;
    revoked?: boolean;
  };
}
export interface AchievementState {
  status: "ready" | "disabled";
  revision: number;
  pending: boolean;
  delayed?: boolean;
  achievements: AchievementRow[];
  totalCount: number;
  unlockedCount: number;
}
export interface AchievementNotification {
  id: string;
  achievementKey: string;
  title: string;
  description: string;
  action: "grant" | "legacy" | "revoke";
  earnedAt: string;
}
