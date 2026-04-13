-- Add user suspension/ban + moderation actions/notices + content removal (irreversible).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserStatus' AND e.enumlabel = 'BANNED'
  ) THEN
    ALTER TYPE "UserStatus" ADD VALUE 'BANNED';
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "suspensionUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "banReason" TEXT;

DO $$ BEGIN
  CREATE TYPE "ModerationTargetType" AS ENUM ('USER', 'DISCUSSION', 'DISCUSSION_REPLY', 'MATERIAL', 'MATERIAL_COMMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ModerationActionType" AS ENUM ('SUSPEND', 'UNSUSPEND', 'SUSPENSION_EXPIRED', 'BAN', 'UNBAN', 'REMOVE_CONTENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ModerationNoticeType" AS ENUM ('ACCOUNT_SUSPENDED', 'ACCOUNT_UNSUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_UNBANNED', 'CONTENT_REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ModerationAction" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "targetUserId" TEXT,
  "targetType" "ModerationTargetType" NOT NULL DEFAULT 'USER',
  "targetId" TEXT,
  "actionType" "ModerationActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "durationSeconds" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModerationAction_actorId_idx" ON "ModerationAction"("actorId");
CREATE INDEX IF NOT EXISTS "ModerationAction_targetUserId_idx" ON "ModerationAction"("targetUserId");
CREATE INDEX IF NOT EXISTS "ModerationAction_targetType_targetId_idx" ON "ModerationAction"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ModerationAction_createdAt_idx" ON "ModerationAction"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModerationAction_actorId_fkey') THEN
    ALTER TABLE "ModerationAction"
      ADD CONSTRAINT "ModerationAction_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModerationAction_targetUserId_fkey') THEN
    ALTER TABLE "ModerationAction"
      ADD CONSTRAINT "ModerationAction_targetUserId_fkey"
      FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ModerationNotice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ModerationNoticeType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "linkUrl" TEXT,
  "actionId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModerationNotice_userId_createdAt_idx" ON "ModerationNotice"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationNotice_readAt_idx" ON "ModerationNotice"("readAt");
CREATE INDEX IF NOT EXISTS "ModerationNotice_actionId_idx" ON "ModerationNotice"("actionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModerationNotice_userId_fkey') THEN
    ALTER TABLE "ModerationNotice"
      ADD CONSTRAINT "ModerationNotice_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModerationNotice_actionId_fkey') THEN
    ALTER TABLE "ModerationNotice"
      ADD CONSTRAINT "ModerationNotice_actionId_fkey"
      FOREIGN KEY ("actionId") REFERENCES "ModerationAction"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Material"
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedById" TEXT,
  ADD COLUMN IF NOT EXISTS "removedReason" TEXT;

ALTER TABLE "MaterialComment"
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedById" TEXT,
  ADD COLUMN IF NOT EXISTS "removedReason" TEXT;

ALTER TABLE "Discussion"
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedById" TEXT,
  ADD COLUMN IF NOT EXISTS "removedReason" TEXT;

ALTER TABLE "DiscussionReply"
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedById" TEXT,
  ADD COLUMN IF NOT EXISTS "removedReason" TEXT;

CREATE INDEX IF NOT EXISTS "User_suspensionUntil_idx" ON "User"("suspensionUntil");
CREATE INDEX IF NOT EXISTS "User_bannedAt_idx" ON "User"("bannedAt");

CREATE INDEX IF NOT EXISTS "Material_removedAt_idx" ON "Material"("removedAt");
CREATE INDEX IF NOT EXISTS "Material_removedById_idx" ON "Material"("removedById");
CREATE INDEX IF NOT EXISTS "MaterialComment_removedAt_idx" ON "MaterialComment"("removedAt");
CREATE INDEX IF NOT EXISTS "MaterialComment_removedById_idx" ON "MaterialComment"("removedById");
CREATE INDEX IF NOT EXISTS "Discussion_removedAt_idx" ON "Discussion"("removedAt");
CREATE INDEX IF NOT EXISTS "Discussion_removedById_idx" ON "Discussion"("removedById");
CREATE INDEX IF NOT EXISTS "DiscussionReply_removedAt_idx" ON "DiscussionReply"("removedAt");
CREATE INDEX IF NOT EXISTS "DiscussionReply_removedById_idx" ON "DiscussionReply"("removedById");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Material_removedById_fkey') THEN
    ALTER TABLE "Material"
      ADD CONSTRAINT "Material_removedById_fkey"
      FOREIGN KEY ("removedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialComment_removedById_fkey') THEN
    ALTER TABLE "MaterialComment"
      ADD CONSTRAINT "MaterialComment_removedById_fkey"
      FOREIGN KEY ("removedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Discussion_removedById_fkey') THEN
    ALTER TABLE "Discussion"
      ADD CONSTRAINT "Discussion_removedById_fkey"
      FOREIGN KEY ("removedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscussionReply_removedById_fkey') THEN
    ALTER TABLE "DiscussionReply"
      ADD CONSTRAINT "DiscussionReply_removedById_fkey"
      FOREIGN KEY ("removedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

