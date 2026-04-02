-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."CreditTransactionType" AS ENUM ('REGISTRATION', 'MATERIAL_PUBLISH', 'MATERIAL_PASSIVE', 'MATERIAL_UNLOCK', 'DISCUSSION_CREATE', 'DISCUSSION_HELP', 'GROUP_SESSION_PARTICIPATE', 'GROUP_SESSION_FACILITATE', 'SPRINT_ENTRY', 'SPRINT_PAYOUT', 'SPECIAL_EVENT');

-- CreateEnum
CREATE TYPE "public"."MaterialDifficulty" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "public"."MaterialStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "public"."MaterialType" AS ENUM ('TEXTUAL', 'PRACTICE_TEST');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('STUDENT', 'PARENT', 'ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "public"."AcademicRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grade" TEXT,
    "subject" TEXT,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AcademicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Certificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "type" "public"."CreditTransactionType" NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Discussion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "subjectId" TEXT,
    "topicId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedReplyId" TEXT,

    CONSTRAINT "Discussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscussionReply" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "parentReplyId" TEXT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscussionReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscussionVote" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardianVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Material" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."MaterialStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "materialType" "public"."MaterialType" NOT NULL DEFAULT 'TEXTUAL',
    "alignmentScore" DOUBLE PRECISION,
    "publishCreditsGrantedAt" TIMESTAMP(3),
    "difficulty" "public"."MaterialDifficulty",
    "objectives" TEXT,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentalConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "status" "public"."ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReplyVote" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'INACTIVE',
    "dateOfBirth" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "grade" TEXT,
    "registrationStep" INTEGER NOT NULL DEFAULT 1,
    "parentEmail" TEXT,
    "parentFirstName" TEXT,
    "parentLastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 15,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicRecord_deletedAt_idx" ON "public"."AcademicRecord"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "AcademicRecord_userId_idx" ON "public"."AcademicRecord"("userId" ASC);

-- CreateIndex
CREATE INDEX "Activity_date_idx" ON "public"."Activity"("date" ASC);

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "public"."Activity"("type" ASC);

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "public"."Activity"("userId" ASC);

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "public"."AuthSession"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "AuthSession_token_idx" ON "public"."AuthSession"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "public"."AuthSession"("token" ASC);

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "public"."AuthSession"("userId" ASC);

-- CreateIndex
CREATE INDEX "Certificate_issuedAt_idx" ON "public"."Certificate"("issuedAt" ASC);

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "public"."Certificate"("userId" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "public"."CreditTransaction"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_referenceId_idx" ON "public"."CreditTransaction"("referenceId" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "public"."CreditTransaction"("type" ASC);

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "public"."CreditTransaction"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Discussion_acceptedReplyId_key" ON "public"."Discussion"("acceptedReplyId" ASC);

-- CreateIndex
CREATE INDEX "Discussion_archivedAt_idx" ON "public"."Discussion"("archivedAt" ASC);

-- CreateIndex
CREATE INDEX "Discussion_lastActivityAt_idx" ON "public"."Discussion"("lastActivityAt" ASC);

-- CreateIndex
CREATE INDEX "Discussion_subjectId_topicId_idx" ON "public"."Discussion"("subjectId" ASC, "topicId" ASC);

-- CreateIndex
CREATE INDEX "Discussion_userId_idx" ON "public"."Discussion"("userId" ASC);

-- CreateIndex
CREATE INDEX "DiscussionReply_discussionId_idx" ON "public"."DiscussionReply"("discussionId" ASC);

-- CreateIndex
CREATE INDEX "DiscussionReply_parentReplyId_idx" ON "public"."DiscussionReply"("parentReplyId" ASC);

-- CreateIndex
CREATE INDEX "DiscussionReply_userId_idx" ON "public"."DiscussionReply"("userId" ASC);

-- CreateIndex
CREATE INDEX "DiscussionVote_discussionId_idx" ON "public"."DiscussionVote"("discussionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionVote_discussionId_userId_key" ON "public"."DiscussionVote"("discussionId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "DiscussionVote_userId_idx" ON "public"."DiscussionVote"("userId" ASC);

-- CreateIndex
CREATE INDEX "GuardianVerification_code_idx" ON "public"."GuardianVerification"("code" ASC);

-- CreateIndex
CREATE INDEX "GuardianVerification_expiresAt_idx" ON "public"."GuardianVerification"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "GuardianVerification_parentEmail_idx" ON "public"."GuardianVerification"("parentEmail" ASC);

-- CreateIndex
CREATE INDEX "GuardianVerification_userId_idx" ON "public"."GuardianVerification"("userId" ASC);

-- CreateIndex
CREATE INDEX "Material_deletedAt_idx" ON "public"."Material"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Material_status_idx" ON "public"."Material"("status" ASC);

-- CreateIndex
CREATE INDEX "Material_subjectId_topicId_idx" ON "public"."Material"("subjectId" ASC, "topicId" ASC);

-- CreateIndex
CREATE INDEX "Material_userId_idx" ON "public"."Material"("userId" ASC);

-- CreateIndex
CREATE INDEX "MaterialAccess_materialId_idx" ON "public"."MaterialAccess"("materialId" ASC);

-- CreateIndex
CREATE INDEX "MaterialAccess_userId_idx" ON "public"."MaterialAccess"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialAccess_userId_materialId_key" ON "public"."MaterialAccess"("userId" ASC, "materialId" ASC);

-- CreateIndex
CREATE INDEX "ParentalConsent_consentVersion_idx" ON "public"."ParentalConsent"("consentVersion" ASC);

-- CreateIndex
CREATE INDEX "ParentalConsent_parentEmail_idx" ON "public"."ParentalConsent"("parentEmail" ASC);

-- CreateIndex
CREATE INDEX "ParentalConsent_status_idx" ON "public"."ParentalConsent"("status" ASC);

-- CreateIndex
CREATE INDEX "ParentalConsent_userId_idx" ON "public"."ParentalConsent"("userId" ASC);

-- CreateIndex
CREATE INDEX "ReplyVote_replyId_idx" ON "public"."ReplyVote"("replyId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReplyVote_replyId_userId_key" ON "public"."ReplyVote"("replyId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ReplyVote_userId_idx" ON "public"."ReplyVote"("userId" ASC);

-- CreateIndex
CREATE INDEX "Session_deletedAt_idx" ON "public"."Session"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Session_startedAt_idx" ON "public"."Session"("startedAt" ASC);

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "public"."Session"("status" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "public"."User"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_parentEmail_idx" ON "public"."User"("parentEmail" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role" ASC);

-- CreateIndex
CREATE INDEX "User_status_idx" ON "public"."User"("status" ASC);

-- AddForeignKey
ALTER TABLE "public"."AcademicRecord" ADD CONSTRAINT "AcademicRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Discussion" ADD CONSTRAINT "Discussion_acceptedReplyId_fkey" FOREIGN KEY ("acceptedReplyId") REFERENCES "public"."DiscussionReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Discussion" ADD CONSTRAINT "Discussion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "public"."Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_parentReplyId_fkey" FOREIGN KEY ("parentReplyId") REFERENCES "public"."DiscussionReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionVote" ADD CONSTRAINT "DiscussionVote_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "public"."Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionVote" ADD CONSTRAINT "DiscussionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardianVerification" ADD CONSTRAINT "GuardianVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Material" ADD CONSTRAINT "Material_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialAccess" ADD CONSTRAINT "MaterialAccess_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialAccess" ADD CONSTRAINT "MaterialAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentalConsent" ADD CONSTRAINT "ParentalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReplyVote" ADD CONSTRAINT "ReplyVote_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "public"."DiscussionReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReplyVote" ADD CONSTRAINT "ReplyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

