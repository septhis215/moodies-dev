-- CreateTable
CREATE TABLE "LikedList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seriesId" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikedList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LikedList_userId_key" ON "LikedList"("userId");

-- AddForeignKey
ALTER TABLE "LikedList" ADD CONSTRAINT "LikedList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
