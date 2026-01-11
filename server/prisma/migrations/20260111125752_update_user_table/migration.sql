-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "reviewBannedUntil" TIMESTAMP(3),
ADD COLUMN     "reviewWarningScore" INTEGER NOT NULL DEFAULT 0;
