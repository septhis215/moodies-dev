/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Watchlist` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_key" ON "Watchlist"("userId");
