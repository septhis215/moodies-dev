/*
  Warnings:

  - You are about to drop the `LikedList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Watchlist` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LikedList" DROP CONSTRAINT "LikedList_userId_fkey";

-- DropForeignKey
ALTER TABLE "Watchlist" DROP CONSTRAINT "Watchlist_userId_fkey";

-- DropTable
DROP TABLE "LikedList";

-- DropTable
DROP TABLE "Watchlist";
