-- AlterEnum
ALTER TYPE "ModerationNoticeType" ADD VALUE 'GUIDED_GROUP_SESSION_STARTING';

-- AlterTable
ALTER TABLE "GuidedGroupSession" ADD COLUMN "startingNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GuidedGroupSession_startingNotifiedAt_idx" ON "GuidedGroupSession"("startingNotifiedAt");

