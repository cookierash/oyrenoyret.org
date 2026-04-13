-- Add user reports with target context (profile/post/reply/material/comment).

DO $$ BEGIN
  CREATE TYPE "UserReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'CHEATING', 'IMPERSONATION', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportTargetType" AS ENUM ('PROFILE', 'DISCUSSION', 'DISCUSSION_REPLY', 'MATERIAL', 'MATERIAL_COMMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL DEFAULT 'PROFILE',
  "targetId" TEXT,
  "reason" "UserReportReason" NOT NULL,
  "details" TEXT,
  "contextUrl" TEXT,
  "status" "UserReportStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserReport"
  ADD COLUMN IF NOT EXISTS "targetType" "ReportTargetType" NOT NULL DEFAULT 'PROFILE',
  ADD COLUMN IF NOT EXISTS "targetId" TEXT;

CREATE INDEX IF NOT EXISTS "UserReport_reporterId_idx" ON "UserReport"("reporterId");
CREATE INDEX IF NOT EXISTS "UserReport_reportedUserId_idx" ON "UserReport"("reportedUserId");
CREATE INDEX IF NOT EXISTS "UserReport_targetType_idx" ON "UserReport"("targetType");
CREATE INDEX IF NOT EXISTS "UserReport_targetType_targetId_idx" ON "UserReport"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "UserReport_status_idx" ON "UserReport"("status");
CREATE INDEX IF NOT EXISTS "UserReport_createdAt_idx" ON "UserReport"("createdAt");
CREATE INDEX IF NOT EXISTS "UserReport_deletedAt_idx" ON "UserReport"("deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserReport_reporterId_fkey') THEN
    ALTER TABLE "UserReport"
      ADD CONSTRAINT "UserReport_reporterId_fkey"
      FOREIGN KEY ("reporterId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserReport_reportedUserId_fkey') THEN
    ALTER TABLE "UserReport"
      ADD CONSTRAINT "UserReport_reportedUserId_fkey"
      FOREIGN KEY ("reportedUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserReport_resolvedById_fkey') THEN
    ALTER TABLE "UserReport"
      ADD CONSTRAINT "UserReport_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

