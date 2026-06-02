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
