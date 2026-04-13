-- CreateEnum
CREATE TYPE "FacilitatorApplicationStatus" AS ENUM ('PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GuidedGroupSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'AUTO_CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "GuidedGroupSessionEnrollmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuidedGroupSessionLearnerSentiment" AS ENUM ('GOOD', 'BAD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationNoticeType" ADD VALUE 'FACILITATOR_APPLICATION_CHANGES_REQUESTED';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'FACILITATOR_APPLICATION_REJECTED';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'FACILITATOR_APPLICATION_APPROVED';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'GUIDED_GROUP_SESSION_CANCELLED';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'GUIDED_GROUP_SESSION_AUTO_CANCELLED';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'GUIDED_GROUP_SESSION_NO_SHOW';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'GUIDED_GROUP_SESSION_ENROLLMENT_APPROVED';
ALTER TYPE "ModerationNoticeType" ADD VALUE 'GUIDED_GROUP_SESSION_ENROLLMENT_REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditTransactionType" ADD VALUE 'GROUP_SESSION_CANCEL_PENALTY';
ALTER TYPE "CreditTransactionType" ADD VALUE 'GROUP_SESSION_NO_SHOW_PENALTY';

-- CreateTable
CREATE TABLE "FacilitatorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "finCode" TEXT NOT NULL,
    "motivationLetter" TEXT NOT NULL,
    "status" "FacilitatorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerMessage" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FacilitatorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilitatorApplicationSubject" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "FacilitatorApplicationSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilitatorSubjectVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "applicationId" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedReason" TEXT,

    CONSTRAINT "FacilitatorSubjectVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedGroupSession" (
    "id" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "learnerCapacity" INTEGER NOT NULL,
    "status" "GuidedGroupSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "whiteboardData" JSONB,
    "activeMaterialId" TEXT,
    "settledAt" TIMESTAMP(3),
    "facilitatorPayoutTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GuidedGroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedGroupSessionEnrollment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GuidedGroupSessionEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "chargedAt" TIMESTAMP(3),
    "chargeTransactionId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidedGroupSessionEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedGroupSessionFacilitatorFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidedGroupSessionFacilitatorFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedGroupSessionLearnerFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "sentiment" "GuidedGroupSessionLearnerSentiment" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidedGroupSessionLearnerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilitatorApplication_userId_createdAt_idx" ON "FacilitatorApplication"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FacilitatorApplication_status_idx" ON "FacilitatorApplication"("status");

-- CreateIndex
CREATE INDEX "FacilitatorApplication_reviewedById_idx" ON "FacilitatorApplication"("reviewedById");

-- CreateIndex
CREATE INDEX "FacilitatorApplication_deletedAt_idx" ON "FacilitatorApplication"("deletedAt");

-- CreateIndex
CREATE INDEX "FacilitatorApplicationSubject_applicationId_idx" ON "FacilitatorApplicationSubject"("applicationId");

-- CreateIndex
CREATE INDEX "FacilitatorApplicationSubject_subjectId_idx" ON "FacilitatorApplicationSubject"("subjectId");

-- CreateIndex
CREATE INDEX "FacilitatorApplicationSubject_approvedAt_idx" ON "FacilitatorApplicationSubject"("approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FacilitatorApplicationSubject_applicationId_subjectId_key" ON "FacilitatorApplicationSubject"("applicationId", "subjectId");

-- CreateIndex
CREATE INDEX "FacilitatorSubjectVerification_subjectId_idx" ON "FacilitatorSubjectVerification"("subjectId");

-- CreateIndex
CREATE INDEX "FacilitatorSubjectVerification_verifiedAt_idx" ON "FacilitatorSubjectVerification"("verifiedAt");

-- CreateIndex
CREATE INDEX "FacilitatorSubjectVerification_revokedAt_idx" ON "FacilitatorSubjectVerification"("revokedAt");

-- CreateIndex
CREATE INDEX "FacilitatorSubjectVerification_applicationId_idx" ON "FacilitatorSubjectVerification"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilitatorSubjectVerification_userId_subjectId_key" ON "FacilitatorSubjectVerification"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "GuidedGroupSession_scheduledAt_idx" ON "GuidedGroupSession"("scheduledAt");

-- CreateIndex
CREATE INDEX "GuidedGroupSession_facilitatorId_scheduledAt_idx" ON "GuidedGroupSession"("facilitatorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "GuidedGroupSession_subjectId_topicId_scheduledAt_idx" ON "GuidedGroupSession"("subjectId", "topicId", "scheduledAt");

-- CreateIndex
CREATE INDEX "GuidedGroupSession_status_idx" ON "GuidedGroupSession"("status");

-- CreateIndex
CREATE INDEX "GuidedGroupSession_deletedAt_idx" ON "GuidedGroupSession"("deletedAt");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionEnrollment_userId_idx" ON "GuidedGroupSessionEnrollment"("userId");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionEnrollment_sessionId_idx" ON "GuidedGroupSessionEnrollment"("sessionId");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionEnrollment_status_idx" ON "GuidedGroupSessionEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuidedGroupSessionEnrollment_sessionId_userId_key" ON "GuidedGroupSessionEnrollment"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionFacilitatorFeedback_facilitatorId_created_idx" ON "GuidedGroupSessionFacilitatorFeedback"("facilitatorId", "createdAt");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionFacilitatorFeedback_learnerId_createdAt_idx" ON "GuidedGroupSessionFacilitatorFeedback"("learnerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuidedGroupSessionFacilitatorFeedback_sessionId_learnerId_key" ON "GuidedGroupSessionFacilitatorFeedback"("sessionId", "learnerId");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionLearnerFeedback_facilitatorId_createdAt_idx" ON "GuidedGroupSessionLearnerFeedback"("facilitatorId", "createdAt");

-- CreateIndex
CREATE INDEX "GuidedGroupSessionLearnerFeedback_learnerId_createdAt_idx" ON "GuidedGroupSessionLearnerFeedback"("learnerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuidedGroupSessionLearnerFeedback_sessionId_learnerId_key" ON "GuidedGroupSessionLearnerFeedback"("sessionId", "learnerId");

-- AddForeignKey
ALTER TABLE "FacilitatorApplication" ADD CONSTRAINT "FacilitatorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorApplication" ADD CONSTRAINT "FacilitatorApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorApplicationSubject" ADD CONSTRAINT "FacilitatorApplicationSubject_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FacilitatorApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorSubjectVerification" ADD CONSTRAINT "FacilitatorSubjectVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorSubjectVerification" ADD CONSTRAINT "FacilitatorSubjectVerification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FacilitatorApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorSubjectVerification" ADD CONSTRAINT "FacilitatorSubjectVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorSubjectVerification" ADD CONSTRAINT "FacilitatorSubjectVerification_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSession" ADD CONSTRAINT "GuidedGroupSession_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSession" ADD CONSTRAINT "GuidedGroupSession_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSession" ADD CONSTRAINT "GuidedGroupSession_activeMaterialId_fkey" FOREIGN KEY ("activeMaterialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionEnrollment" ADD CONSTRAINT "GuidedGroupSessionEnrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuidedGroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionEnrollment" ADD CONSTRAINT "GuidedGroupSessionEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionEnrollment" ADD CONSTRAINT "GuidedGroupSessionEnrollment_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionFacilitatorFeedback" ADD CONSTRAINT "GuidedGroupSessionFacilitatorFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuidedGroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionFacilitatorFeedback" ADD CONSTRAINT "GuidedGroupSessionFacilitatorFeedback_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionFacilitatorFeedback" ADD CONSTRAINT "GuidedGroupSessionFacilitatorFeedback_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionLearnerFeedback" ADD CONSTRAINT "GuidedGroupSessionLearnerFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuidedGroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionLearnerFeedback" ADD CONSTRAINT "GuidedGroupSessionLearnerFeedback_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedGroupSessionLearnerFeedback" ADD CONSTRAINT "GuidedGroupSessionLearnerFeedback_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

