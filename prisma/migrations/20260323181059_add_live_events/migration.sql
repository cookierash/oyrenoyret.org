-- CreateEnum
CREATE TYPE "LiveEventType" AS ENUM ('PROBLEM_SPRINT', 'EVENT');

-- CreateEnum
CREATE TYPE "LiveEventEnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LiveEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "difficulty" "MaterialDifficulty",
    "creditCost" DOUBLE PRECISION NOT NULL,
    "type" "LiveEventType" NOT NULL DEFAULT 'PROBLEM_SPRINT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveEventEnrollment" (
    "id" TEXT NOT NULL,
    "liveEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LiveEventEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveEventEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveEvent_date_idx" ON "LiveEvent"("date");

-- CreateIndex
CREATE INDEX "LiveEvent_type_idx" ON "LiveEvent"("type");

-- CreateIndex
CREATE INDEX "LiveEvent_deletedAt_idx" ON "LiveEvent"("deletedAt");

-- CreateIndex
CREATE INDEX "LiveEventEnrollment_userId_idx" ON "LiveEventEnrollment"("userId");

-- CreateIndex
CREATE INDEX "LiveEventEnrollment_liveEventId_idx" ON "LiveEventEnrollment"("liveEventId");

-- CreateIndex
CREATE INDEX "LiveEventEnrollment_status_idx" ON "LiveEventEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEventEnrollment_liveEventId_userId_key" ON "LiveEventEnrollment"("liveEventId", "userId");

-- CreateIndex
CREATE INDEX "LiveAnnouncement_createdAt_idx" ON "LiveAnnouncement"("createdAt");

-- CreateIndex
CREATE INDEX "LiveAnnouncement_deletedAt_idx" ON "LiveAnnouncement"("deletedAt");

-- AddForeignKey
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventEnrollment" ADD CONSTRAINT "LiveEventEnrollment_liveEventId_fkey" FOREIGN KEY ("liveEventId") REFERENCES "LiveEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEventEnrollment" ADD CONSTRAINT "LiveEventEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveAnnouncement" ADD CONSTRAINT "LiveAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
