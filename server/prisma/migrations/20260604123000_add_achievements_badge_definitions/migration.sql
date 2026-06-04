CREATE TABLE "achievements" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "requirementType" TEXT NOT NULL,
  "requirementTarget" TEXT NOT NULL,
  "requiredCount" INTEGER,
  "progressLogic" TEXT NOT NULL,
  "reasoningTemplate" TEXT NOT NULL,
  "lockedHint" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "badge_definitions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "badgeName" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "mascotMood" TEXT NOT NULL,
  "mascotMotion" TEXT NOT NULL,
  "colorTheme" JSONB NOT NULL,
  "lockedVisualState" JSONB NOT NULL,
  "unlockedVisualState" JSONB NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_achievements" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "currentProgress" INTEGER NOT NULL DEFAULT 0,
  "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unlocked" BOOLEAN NOT NULL DEFAULT false,
  "unlockedAt" TIMESTAMP(3),
  "relatedActivityRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");
CREATE INDEX "achievements_category_idx" ON "achievements"("category");
CREATE INDEX "achievements_active_idx" ON "achievements"("active");

CREATE UNIQUE INDEX "badge_definitions_key_key" ON "badge_definitions"("key");
CREATE UNIQUE INDEX "badge_definitions_achievementId_key" ON "badge_definitions"("achievementId");
CREATE INDEX "badge_definitions_rarity_idx" ON "badge_definitions"("rarity");
CREATE INDEX "badge_definitions_displayOrder_idx" ON "badge_definitions"("displayOrder");
CREATE INDEX "badge_definitions_active_idx" ON "badge_definitions"("active");

CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");
CREATE INDEX "user_achievements_achievementId_idx" ON "user_achievements"("achievementId");
CREATE INDEX "user_achievements_unlocked_idx" ON "user_achievements"("unlocked");
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

ALTER TABLE "badge_definitions" ADD CONSTRAINT "badge_definitions_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
