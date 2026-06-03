-- AlterTable
ALTER TABLE "User" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "media_stats" (
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_stats_pkey" PRIMARY KEY ("tmdbId", "mediaType")
);

-- ─── One-time backfill (single grouped pass per source, not per-request) ───

-- Per-user review counts
UPDATE "User" u
SET "reviewCount" = sub.cnt
FROM (
    SELECT "userId", COUNT(*)::int AS cnt
    FROM "reviews"
    GROUP BY "userId"
) sub
WHERE u.id = sub."userId";

-- Per-content counters: likes + saves come from the array columns,
-- reviews from the normalized rows. unnest expands arrays once; the regex
-- guard skips any non-numeric stored ids before casting to int.
INSERT INTO "media_stats" ("tmdbId", "mediaType", "likeCount", "savedCount", "reviewCount", "updatedAt")
SELECT
    "tmdbId",
    "mediaType",
    SUM(like_c)::int,
    SUM(saved_c)::int,
    SUM(review_c)::int,
    NOW()
FROM (
    SELECT t.id::int AS "tmdbId", 'MOVIE'::"MediaType" AS "mediaType", 1 AS like_c, 0 AS saved_c, 0 AS review_c
        FROM "LikedList" l, unnest(l."movieId") AS t(id) WHERE t.id ~ '^[0-9]+$'
    UNION ALL
    SELECT t.id::int, 'TV'::"MediaType", 1, 0, 0
        FROM "LikedList" l, unnest(l."seriesId") AS t(id) WHERE t.id ~ '^[0-9]+$'
    UNION ALL
    SELECT t.id::int, 'MOVIE'::"MediaType", 0, 1, 0
        FROM "Watchlist" w, unnest(w."movieId") AS t(id) WHERE t.id ~ '^[0-9]+$'
    UNION ALL
    SELECT t.id::int, 'TV'::"MediaType", 0, 1, 0
        FROM "Watchlist" w, unnest(w."seriesId") AS t(id) WHERE t.id ~ '^[0-9]+$'
    UNION ALL
    SELECT "tmdbId", "mediaType", 0, 0, 1
        FROM "reviews"
) agg
GROUP BY "tmdbId", "mediaType";
