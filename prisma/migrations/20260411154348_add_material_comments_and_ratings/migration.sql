-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Material" ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MaterialComment" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialComment_materialId_idx" ON "MaterialComment"("materialId");

-- CreateIndex
CREATE INDEX "MaterialComment_parentCommentId_idx" ON "MaterialComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "MaterialComment_userId_idx" ON "MaterialComment"("userId");

-- CreateIndex
CREATE INDEX "MaterialComment_deletedAt_idx" ON "MaterialComment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCommentVote_commentId_userId_key" ON "MaterialCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "MaterialCommentVote_commentId_idx" ON "MaterialCommentVote"("commentId");

-- CreateIndex
CREATE INDEX "MaterialCommentVote_userId_idx" ON "MaterialCommentVote"("userId");

-- AddForeignKey
ALTER TABLE "MaterialComment" ADD CONSTRAINT "MaterialComment_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialComment" ADD CONSTRAINT "MaterialComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "MaterialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialComment" ADD CONSTRAINT "MaterialComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCommentVote" ADD CONSTRAINT "MaterialCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "MaterialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCommentVote" ADD CONSTRAINT "MaterialCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

