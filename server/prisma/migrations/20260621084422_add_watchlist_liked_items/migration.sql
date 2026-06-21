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

-- CreateIndex
CREATE INDEX "watchlist_items_userId_addedAt_idx" ON "watchlist_items"("userId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_userId_tmdbId_mediaType_key" ON "watchlist_items"("userId", "tmdbId", "mediaType");

-- CreateIndex
CREATE INDEX "liked_items_userId_addedAt_idx" ON "liked_items"("userId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "liked_items_userId_tmdbId_mediaType_key" ON "liked_items"("userId", "tmdbId", "mediaType");

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liked_items" ADD CONSTRAINT "liked_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy existing saved/liked titles from the legacy array columns into the
-- normalized tables. Idempotent (ON CONFLICT DO NOTHING) and guards against any
-- non-numeric ids, so it is safe to re-run and a no-op once applied. The legacy
-- Watchlist/LikedList tables are left intact (dropped in a later cleanup migration).
INSERT INTO "watchlist_items" ("id", "userId", "tmdbId", "mediaType", "addedAt")
SELECT gen_random_uuid(), w."userId", t.tmdb::int, 'MOVIE'::"MediaType", w."addedAt"
FROM "Watchlist" w, unnest(w."movieId") AS t(tmdb)
WHERE t.tmdb ~ '^[0-9]+$'
ON CONFLICT ("userId", "tmdbId", "mediaType") DO NOTHING;

INSERT INTO "watchlist_items" ("id", "userId", "tmdbId", "mediaType", "addedAt")
SELECT gen_random_uuid(), w."userId", t.tmdb::int, 'TV'::"MediaType", w."addedAt"
FROM "Watchlist" w, unnest(w."seriesId") AS t(tmdb)
WHERE t.tmdb ~ '^[0-9]+$'
ON CONFLICT ("userId", "tmdbId", "mediaType") DO NOTHING;

INSERT INTO "liked_items" ("id", "userId", "tmdbId", "mediaType", "addedAt")
SELECT gen_random_uuid(), l."userId", t.tmdb::int, 'MOVIE'::"MediaType", l."addedAt"
FROM "LikedList" l, unnest(l."movieId") AS t(tmdb)
WHERE t.tmdb ~ '^[0-9]+$'
ON CONFLICT ("userId", "tmdbId", "mediaType") DO NOTHING;

INSERT INTO "liked_items" ("id", "userId", "tmdbId", "mediaType", "addedAt")
SELECT gen_random_uuid(), l."userId", t.tmdb::int, 'TV'::"MediaType", l."addedAt"
FROM "LikedList" l, unnest(l."seriesId") AS t(tmdb)
WHERE t.tmdb ~ '^[0-9]+$'
ON CONFLICT ("userId", "tmdbId", "mediaType") DO NOTHING;
