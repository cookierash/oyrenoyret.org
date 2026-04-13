-- Track when user last read notifications (used for unread badge).
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "notificationsReadAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

