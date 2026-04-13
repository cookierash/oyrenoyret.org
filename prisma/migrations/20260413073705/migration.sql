-- AlterTable
ALTER TABLE "LiveEvent" ADD COLUMN     "maxParticipants" INTEGER,
ADD COLUMN     "prompt" TEXT;

-- CreateTable
CREATE TABLE "LiveEventSubmission" (
    "id" TEXT NOT NULL,
    "liveEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveEventSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAz" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAz" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveEventSubmission_liveEventId_idx" ON "LiveEventSubmission"("liveEventId");

-- CreateIndex
CREATE INDEX "LiveEventSubmission_userId_idx" ON "LiveEventSubmission"("userId");

-- CreateIndex
CREATE INDEX "LiveEventSubmission_deletedAt_idx" ON "LiveEventSubmission"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEventSubmission_liveEventId_userId_key" ON "LiveEventSubmission"("liveEventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Subject_slug_idx" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Subject_deletedAt_idx" ON "Subject"("deletedAt");

-- CreateIndex
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");

-- CreateIndex
CREATE INDEX "Topic_slug_idx" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_deletedAt_idx" ON "Topic"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_slug_key" ON "Topic"("subjectId", "slug");

-- AddForeignKey
ALTER TABLE "LiveEventSubmission" ADD CONSTRAINT "LiveEventSubmission_liveEventId_fkey" FOREIGN KEY ("liveEventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventSubmission" ADD CONSTRAINT "LiveEventSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
