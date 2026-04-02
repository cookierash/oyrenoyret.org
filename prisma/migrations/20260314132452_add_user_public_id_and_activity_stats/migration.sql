/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publicId" TEXT;

-- CreateTable
CREATE TABLE "UserActivityStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userPublicId" TEXT NOT NULL,
    "materialsSharedTextual" INTEGER NOT NULL DEFAULT 0,
    "materialsSharedPractice" INTEGER NOT NULL DEFAULT 0,
    "liveProblemSprintTop3" INTEGER NOT NULL DEFAULT 0,
    "liveGuidedGroupFacilitated" INTEGER NOT NULL DEFAULT 0,
    "discussionHelps" INTEGER NOT NULL DEFAULT 0,
    "materialsPurchasedFromUser" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivityStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserActivityStats_userId_key" ON "UserActivityStats"("userId");

-- CreateIndex
CREATE INDEX "UserActivityStats_userPublicId_idx" ON "UserActivityStats"("userPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

-- AddForeignKey
ALTER TABLE "UserActivityStats" ADD CONSTRAINT "UserActivityStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
