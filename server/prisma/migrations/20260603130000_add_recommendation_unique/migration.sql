-- Drop pre-existing duplicate recommendations before enforcing uniqueness,
-- keeping the most recent row per (userId, moodId, tmdbId, mediaType).
DELETE FROM "recommendations" r
WHERE r.id NOT IN (
    SELECT DISTINCT ON ("userId", "moodId", "tmdbId", "mediaType") id
    FROM "recommendations"
    ORDER BY "userId", "moodId", "tmdbId", "mediaType", "createdAt" DESC
);

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_userId_moodId_tmdbId_mediaType_key"
    ON "recommendations"("userId", "moodId", "tmdbId", "mediaType");
