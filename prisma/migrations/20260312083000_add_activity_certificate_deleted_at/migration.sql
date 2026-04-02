-- Add missing soft-delete columns and indexes to match prisma/schema.prisma
-- and remove the Activity.date default to align with app expectations.

-- AlterTable
ALTER TABLE "Activity"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ALTER COLUMN "date" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Certificate"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Activity_deletedAt_idx" ON "Activity"("deletedAt");

-- CreateIndex
CREATE INDEX "Certificate_deletedAt_idx" ON "Certificate"("deletedAt");
