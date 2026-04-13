-- Add localized slugs for curriculum subjects/topics (AZ).

-- Subject
ALTER TABLE "Subject" ADD COLUMN "slugAz" TEXT;
UPDATE "Subject" SET "slugAz" = "slug" WHERE "slugAz" IS NULL;
ALTER TABLE "Subject" ALTER COLUMN "slugAz" SET NOT NULL;

CREATE UNIQUE INDEX "Subject_slugAz_key" ON "Subject"("slugAz");
CREATE INDEX "Subject_slugAz_idx" ON "Subject"("slugAz");

-- Topic
ALTER TABLE "Topic" ADD COLUMN "slugAz" TEXT;
UPDATE "Topic" SET "slugAz" = "slug" WHERE "slugAz" IS NULL;
ALTER TABLE "Topic" ALTER COLUMN "slugAz" SET NOT NULL;

CREATE UNIQUE INDEX "Topic_subjectId_slugAz_key" ON "Topic"("subjectId", "slugAz");
CREATE INDEX "Topic_slugAz_idx" ON "Topic"("slugAz");

