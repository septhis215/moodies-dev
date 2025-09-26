-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('MOVIE', 'TV');

-- CreateTable
CREATE TABLE "public"."moods" (
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
CREATE TABLE "public"."mood_logs" (
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
CREATE TABLE "public"."recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moodId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "public"."MediaType" NOT NULL,
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
CREATE TABLE "public"."user_preferences" (
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
CREATE TABLE "public"."content_cache" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "public"."MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "genreIds" INTEGER[],
    "voteAverage" DECIMAL(3,2) NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "releaseDate" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "popularity" DECIMAL(8,3) NOT NULL,
    "adult" BOOLEAN NOT NULL DEFAULT false,
    "originalLanguage" TEXT NOT NULL,
    "metadata" JSONB,
    "lastFetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moods_name_key" ON "public"."moods"("name");

-- CreateIndex
CREATE INDEX "mood_logs_userId_idx" ON "public"."mood_logs"("userId");

-- CreateIndex
CREATE INDEX "mood_logs_createdAt_idx" ON "public"."mood_logs"("createdAt");

-- CreateIndex
CREATE INDEX "mood_logs_userId_moodId_idx" ON "public"."mood_logs"("userId", "moodId");

-- CreateIndex
CREATE INDEX "recommendations_userId_moodId_idx" ON "public"."recommendations"("userId", "moodId");

-- CreateIndex
CREATE INDEX "recommendations_score_idx" ON "public"."recommendations"("score");

-- CreateIndex
CREATE INDEX "recommendations_createdAt_idx" ON "public"."recommendations"("createdAt");

-- CreateIndex
CREATE INDEX "recommendations_tmdbId_mediaType_idx" ON "public"."recommendations"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "public"."user_preferences"("userId");

-- CreateIndex
CREATE INDEX "content_cache_genreIds_idx" ON "public"."content_cache"("genreIds");

-- CreateIndex
CREATE INDEX "content_cache_voteAverage_idx" ON "public"."content_cache"("voteAverage");

-- CreateIndex
CREATE INDEX "content_cache_popularity_idx" ON "public"."content_cache"("popularity");

-- CreateIndex
CREATE INDEX "content_cache_lastFetched_idx" ON "public"."content_cache"("lastFetched");

-- CreateIndex
CREATE UNIQUE INDEX "content_cache_tmdbId_mediaType_key" ON "public"."content_cache"("tmdbId", "mediaType");

-- AddForeignKey
ALTER TABLE "public"."mood_logs" ADD CONSTRAINT "mood_logs_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "public"."moods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recommendations" ADD CONSTRAINT "recommendations_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "public"."moods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
