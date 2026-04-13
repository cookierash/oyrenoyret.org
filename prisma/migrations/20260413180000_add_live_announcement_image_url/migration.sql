-- Add imageUrl to LiveAnnouncement so uploaded banners can be stored and rendered.
ALTER TABLE "LiveAnnouncement"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

