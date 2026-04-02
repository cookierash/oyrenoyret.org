-- Add questionCount to Material for faster practice test cost calculations
ALTER TABLE "Material" ADD COLUMN "questionCount" INTEGER NOT NULL DEFAULT 0;

-- Composite index to speed material catalog queries
CREATE INDEX "Material_subjectId_topicId_status_deletedAt_publishedAt_idx"
ON "Material"("subjectId", "topicId", "status", "deletedAt", "publishedAt");

-- Composite index to speed discussion listing by activity
CREATE INDEX "Discussion_archivedAt_lastActivityAt_idx"
ON "Discussion"("archivedAt", "lastActivityAt");
