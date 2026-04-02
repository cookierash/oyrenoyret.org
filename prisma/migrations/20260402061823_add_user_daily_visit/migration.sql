-- CreateTable
CREATE TABLE "UserDailyVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDailyVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDailyVisit_userId_idx" ON "UserDailyVisit"("userId");

-- CreateIndex
CREATE INDEX "UserDailyVisit_dayNumber_idx" ON "UserDailyVisit"("dayNumber");

-- CreateIndex
CREATE INDEX "UserDailyVisit_visitedAt_idx" ON "UserDailyVisit"("visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyVisit_userId_dayNumber_key" ON "UserDailyVisit"("userId", "dayNumber");

-- AddForeignKey
ALTER TABLE "UserDailyVisit" ADD CONSTRAINT "UserDailyVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
