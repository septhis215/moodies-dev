-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "provider" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "age" INTEGER,
    "preferredGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewWarningScore" INTEGER NOT NULL DEFAULT 0,
    "reviewBannedUntil" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "discloseProfileInfo" BOOLEAN NOT NULL DEFAULT true,
    "discloseWatchlist" BOOLEAN NOT NULL DEFAULT false,
    "discloseReviews" BOOLEAN NOT NULL DEFAULT true,
    "discloseLiked" BOOLEAN NOT NULL DEFAULT false,
    "discloseBadges" BOOLEAN NOT NULL DEFAULT true,
    "discloseRecentActivity" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "previousValidUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "resultMood" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liked_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liked_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "rating" SMALLINT NOT NULL,
    "content" TEXT NOT NULL,
    "moodEmojis" TEXT[],
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "flaggedReason" TEXT,
    "toxicityScore" DOUBLE PRECISION,
    "profanityHit" BOOLEAN NOT NULL DEFAULT false,
    "affectsRating" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_replies" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reactions" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reply_reactions" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reply_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_replies" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_post_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reply_reactions" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_reply_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT[],
    "tmdbGenres" INTEGER[],
    "valence" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "arousal" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moodId" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL DEFAULT 5,
    "tags" TEXT[],
    "context" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moodId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "genreIds" INTEGER[],
    "voteAverage" DECIMAL(3,2) NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "releaseDate" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "score" DECIMAL(4,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "metadata" JSONB,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredGenres" INTEGER[],
    "dislikedGenres" INTEGER[],
    "preferredMoods" TEXT[],
    "minRating" DECIMAL(3,2) NOT NULL DEFAULT 6.0,
    "preferredRuntime" JSONB,
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "includeAdult" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_night_previews" (
    "choice" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_night_previews_pkey" PRIMARY KEY ("choice")
);

-- CreateTable
CREATE TABLE "media_details" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "popularity" DOUBLE PRECISION,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tv_season_bundles" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tv_season_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_cache" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "limit" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_stats" (
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_stats_pkey" PRIMARY KEY ("tmdbId","mediaType")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_previousTokenHash_key" ON "auth_sessions"("previousTokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailVerification_email_code_idx" ON "EmailVerification"("email", "code");

-- CreateIndex
CREATE INDEX "EmailVerification_expiresAt_idx" ON "EmailVerification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "achievements"("category");

-- CreateIndex
CREATE INDEX "achievements_active_idx" ON "achievements"("active");

-- CreateIndex
CREATE UNIQUE INDEX "badge_definitions_key_key" ON "badge_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "badge_definitions_achievementId_key" ON "badge_definitions"("achievementId");

-- CreateIndex
CREATE INDEX "badge_definitions_rarity_idx" ON "badge_definitions"("rarity");

-- CreateIndex
CREATE INDEX "badge_definitions_displayOrder_idx" ON "badge_definitions"("displayOrder");

-- CreateIndex
CREATE INDEX "badge_definitions_active_idx" ON "badge_definitions"("active");

-- CreateIndex
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");

-- CreateIndex
CREATE INDEX "user_achievements_achievementId_idx" ON "user_achievements"("achievementId");

-- CreateIndex
CREATE INDEX "user_achievements_unlocked_idx" ON "user_achievements"("unlocked");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "watchlist_items_userId_addedAt_idx" ON "watchlist_items"("userId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_userId_tmdbId_mediaType_key" ON "watchlist_items"("userId", "tmdbId", "mediaType");

-- CreateIndex
CREATE INDEX "liked_items_userId_addedAt_idx" ON "liked_items"("userId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "liked_items_userId_tmdbId_mediaType_key" ON "liked_items"("userId", "tmdbId", "mediaType");

-- CreateIndex
CREATE INDEX "reviews_tmdbId_mediaType_idx" ON "reviews"("tmdbId", "mediaType");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_createdAt_idx" ON "reviews"("createdAt");

-- CreateIndex
CREATE INDEX "review_replies_reviewId_idx" ON "review_replies"("reviewId");

-- CreateIndex
CREATE INDEX "review_reactions_reviewId_type_idx" ON "review_reactions"("reviewId", "type");

-- CreateIndex
CREATE INDEX "review_reactions_userId_idx" ON "review_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "review_reactions_reviewId_userId_key" ON "review_reactions"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "review_reply_reactions_replyId_type_idx" ON "review_reply_reactions"("replyId", "type");

-- CreateIndex
CREATE INDEX "review_reply_reactions_userId_idx" ON "review_reply_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "review_reply_reactions_replyId_userId_key" ON "review_reply_reactions"("replyId", "userId");

-- CreateIndex
CREATE INDEX "community_posts_createdAt_id_idx" ON "community_posts"("createdAt", "id");

-- CreateIndex
CREATE INDEX "community_posts_userId_idx" ON "community_posts"("userId");

-- CreateIndex
CREATE INDEX "community_replies_postId_createdAt_id_idx" ON "community_replies"("postId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "community_replies_userId_idx" ON "community_replies"("userId");

-- CreateIndex
CREATE INDEX "community_post_reactions_postId_type_idx" ON "community_post_reactions"("postId", "type");

-- CreateIndex
CREATE INDEX "community_post_reactions_userId_idx" ON "community_post_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_post_reactions_postId_userId_key" ON "community_post_reactions"("postId", "userId");

-- CreateIndex
CREATE INDEX "community_reply_reactions_replyId_type_idx" ON "community_reply_reactions"("replyId", "type");

-- CreateIndex
CREATE INDEX "community_reply_reactions_userId_idx" ON "community_reply_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_reply_reactions_replyId_userId_key" ON "community_reply_reactions"("replyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "moods_name_key" ON "moods"("name");

-- CreateIndex
CREATE INDEX "mood_logs_userId_idx" ON "mood_logs"("userId");

-- CreateIndex
CREATE INDEX "mood_logs_createdAt_idx" ON "mood_logs"("createdAt");

-- CreateIndex
CREATE INDEX "mood_logs_userId_moodId_idx" ON "mood_logs"("userId", "moodId");

-- CreateIndex
CREATE INDEX "recommendations_userId_moodId_idx" ON "recommendations"("userId", "moodId");

-- CreateIndex
CREATE INDEX "recommendations_score_idx" ON "recommendations"("score");

-- CreateIndex
CREATE INDEX "recommendations_createdAt_idx" ON "recommendations"("createdAt");

-- CreateIndex
CREATE INDEX "recommendations_tmdbId_mediaType_idx" ON "recommendations"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_userId_moodId_tmdbId_mediaType_key" ON "recommendations"("userId", "moodId", "tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "media_details_fetchedAt_idx" ON "media_details"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_details_tmdbId_mediaType_key" ON "media_details"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "tv_season_bundles_tmdbId_key" ON "tv_season_bundles"("tmdbId");

-- CreateIndex
CREATE INDEX "tv_season_bundles_fetchedAt_idx" ON "tv_season_bundles"("fetchedAt");

-- CreateIndex
CREATE INDEX "recommendation_cache_fetchedAt_idx" ON "recommendation_cache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_cache_tmdbId_mediaType_limit_key" ON "recommendation_cache"("tmdbId", "mediaType", "limit");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_definitions" ADD CONSTRAINT "badge_definitions_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liked_items" ADD CONSTRAINT "liked_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reactions" ADD CONSTRAINT "review_reactions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reactions" ADD CONSTRAINT "review_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reply_reactions" ADD CONSTRAINT "review_reply_reactions_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "review_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reply_reactions" ADD CONSTRAINT "review_reply_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_replies" ADD CONSTRAINT "community_replies_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_replies" ADD CONSTRAINT "community_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_reactions" ADD CONSTRAINT "community_post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_reactions" ADD CONSTRAINT "community_post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reply_reactions" ADD CONSTRAINT "community_reply_reactions_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "community_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reply_reactions" ADD CONSTRAINT "community_reply_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_logs" ADD CONSTRAINT "mood_logs_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "moods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "moods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

