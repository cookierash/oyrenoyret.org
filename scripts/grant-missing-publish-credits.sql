-- One-time fix: Add 1 credit per published material that never received publish credits.
-- Run: npx prisma db execute --file scripts/grant-missing-publish-credits.sql

-- Add 1 credit per material to each user
UPDATE "User" u
SET credits = credits + sub.credits_to_add
FROM (
  SELECT "userId", COUNT(*) * 1 AS credits_to_add
  FROM "Material"
  WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND "publishCreditsGrantedAt" IS NULL
  GROUP BY "userId"
) sub
WHERE u.id = sub."userId";

-- Mark those materials as having received credits
UPDATE "Material"
SET "publishCreditsGrantedAt" = NOW()
WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND "publishCreditsGrantedAt" IS NULL;
