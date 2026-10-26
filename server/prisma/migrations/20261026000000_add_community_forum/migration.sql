-- Additive migration. Requires the existing User table and ReactionType enum.
BEGIN;

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

-- Moodies uses Nest JWT sessions, not Supabase Auth. Access these tables through
-- the Nest API; do not allow the Supabase Data API to bypass its write guards.
ALTER TABLE "community_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_post_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_reply_reactions" ENABLE ROW LEVEL SECURITY;

COMMIT;
