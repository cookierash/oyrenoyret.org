-- Live problem sprint: structured problems + answers (MCQ + short answer) with image attachments.

DO $$ BEGIN
  CREATE TYPE "LiveEventProblemType" AS ENUM ('MULTIPLE_CHOICE', 'SHORT_ANSWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LiveEventProblem" (
  "id" TEXT NOT NULL,
  "liveEventId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "type" "LiveEventProblemType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LiveEventProblem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiveEventProblemOption" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LiveEventProblemOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiveEventSubmissionAnswer" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "type" "LiveEventProblemType" NOT NULL,
  "textAnswer" TEXT,
  "selectedOptionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LiveEventSubmissionAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiveEventSubmissionAnswerImage" (
  "id" TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveEventSubmissionAnswerImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveEventProblem_liveEventId_order_key"
  ON "LiveEventProblem"("liveEventId", "order");
CREATE INDEX IF NOT EXISTS "LiveEventProblem_liveEventId_idx"
  ON "LiveEventProblem"("liveEventId");
CREATE INDEX IF NOT EXISTS "LiveEventProblem_type_idx"
  ON "LiveEventProblem"("type");

CREATE UNIQUE INDEX IF NOT EXISTS "LiveEventProblemOption_problemId_order_key"
  ON "LiveEventProblemOption"("problemId", "order");
CREATE INDEX IF NOT EXISTS "LiveEventProblemOption_problemId_idx"
  ON "LiveEventProblemOption"("problemId");

CREATE UNIQUE INDEX IF NOT EXISTS "LiveEventSubmissionAnswer_submissionId_problemId_key"
  ON "LiveEventSubmissionAnswer"("submissionId", "problemId");
CREATE INDEX IF NOT EXISTS "LiveEventSubmissionAnswer_submissionId_idx"
  ON "LiveEventSubmissionAnswer"("submissionId");
CREATE INDEX IF NOT EXISTS "LiveEventSubmissionAnswer_problemId_idx"
  ON "LiveEventSubmissionAnswer"("problemId");
CREATE INDEX IF NOT EXISTS "LiveEventSubmissionAnswer_selectedOptionId_idx"
  ON "LiveEventSubmissionAnswer"("selectedOptionId");

CREATE UNIQUE INDEX IF NOT EXISTS "LiveEventSubmissionAnswerImage_answerId_order_key"
  ON "LiveEventSubmissionAnswerImage"("answerId", "order");
CREATE INDEX IF NOT EXISTS "LiveEventSubmissionAnswerImage_answerId_idx"
  ON "LiveEventSubmissionAnswerImage"("answerId");
CREATE INDEX IF NOT EXISTS "LiveEventSubmissionAnswerImage_key_idx"
  ON "LiveEventSubmissionAnswerImage"("key");

DO $$ BEGIN
  ALTER TABLE "LiveEventProblem"
    ADD CONSTRAINT "LiveEventProblem_liveEventId_fkey"
    FOREIGN KEY ("liveEventId") REFERENCES "LiveEvent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiveEventProblemOption"
    ADD CONSTRAINT "LiveEventProblemOption_problemId_fkey"
    FOREIGN KEY ("problemId") REFERENCES "LiveEventProblem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiveEventSubmissionAnswer"
    ADD CONSTRAINT "LiveEventSubmissionAnswer_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "LiveEventSubmission"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiveEventSubmissionAnswer"
    ADD CONSTRAINT "LiveEventSubmissionAnswer_problemId_fkey"
    FOREIGN KEY ("problemId") REFERENCES "LiveEventProblem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiveEventSubmissionAnswer"
    ADD CONSTRAINT "LiveEventSubmissionAnswer_selectedOptionId_fkey"
    FOREIGN KEY ("selectedOptionId") REFERENCES "LiveEventProblemOption"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiveEventSubmissionAnswerImage"
    ADD CONSTRAINT "LiveEventSubmissionAnswerImage_answerId_fkey"
    FOREIGN KEY ("answerId") REFERENCES "LiveEventSubmissionAnswer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

