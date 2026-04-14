-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'DAILY_WHEEL';

-- CreateTable
CREATE TABLE "DailyWheelSpin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "reward" INTEGER NOT NULL,
    "creditTransactionId" TEXT,
    "spunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWheelSpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyWheelSpin_userId_idx" ON "DailyWheelSpin"("userId");

-- CreateIndex
CREATE INDEX "DailyWheelSpin_dayNumber_idx" ON "DailyWheelSpin"("dayNumber");

-- CreateIndex
CREATE INDEX "DailyWheelSpin_spunAt_idx" ON "DailyWheelSpin"("spunAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWheelSpin_userId_dayNumber_key" ON "DailyWheelSpin"("userId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWheelSpin_creditTransactionId_key" ON "DailyWheelSpin"("creditTransactionId");

-- AddForeignKey
ALTER TABLE "DailyWheelSpin" ADD CONSTRAINT "DailyWheelSpin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWheelSpin" ADD CONSTRAINT "DailyWheelSpin_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "CreditTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

