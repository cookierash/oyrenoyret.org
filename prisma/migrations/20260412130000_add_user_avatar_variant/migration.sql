-- Add avatar variant to users (maps to public `/avatar-<variant>.png`).

ALTER TABLE "User"
ADD COLUMN "avatarVariant" TEXT NOT NULL DEFAULT 'regular';

