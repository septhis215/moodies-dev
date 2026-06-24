-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

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

-- CreateIndex
CREATE UNIQUE INDEX "review_reactions_reviewId_userId_key" ON "review_reactions"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "review_reactions_reviewId_type_idx" ON "review_reactions"("reviewId", "type");

-- CreateIndex
CREATE INDEX "review_reactions_userId_idx" ON "review_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "review_reply_reactions_replyId_userId_key" ON "review_reply_reactions"("replyId", "userId");

-- CreateIndex
CREATE INDEX "review_reply_reactions_replyId_type_idx" ON "review_reply_reactions"("replyId", "type");

-- CreateIndex
CREATE INDEX "review_reply_reactions_userId_idx" ON "review_reply_reactions"("userId");

-- AddForeignKey
ALTER TABLE "review_reactions" ADD CONSTRAINT "review_reactions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reactions" ADD CONSTRAINT "review_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reply_reactions" ADD CONSTRAINT "review_reply_reactions_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "review_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reply_reactions" ADD CONSTRAINT "review_reply_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
