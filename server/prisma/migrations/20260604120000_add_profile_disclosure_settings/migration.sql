ALTER TABLE "User"
  ADD COLUMN "discloseProfileInfo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discloseWatchlist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "discloseReviews" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discloseLiked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "discloseBadges" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discloseRecentActivity" BOOLEAN NOT NULL DEFAULT true;
