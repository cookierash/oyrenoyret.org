-- Add hashed token storage for sessions.
-- - New sessions store only tokenHash (SHA-256 of the cookie token).
-- - token is kept as nullable legacy field for a safe rollout; active sessions
--   can be migrated opportunistically by the app and then cleared.

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN "tokenHash" TEXT;

-- token is now optional (legacy)
ALTER TABLE "AuthSession" ALTER COLUMN "token" DROP NOT NULL;

-- Drop redundant non-unique index on token (unique constraint already exists)
DROP INDEX IF EXISTS "AuthSession_token_idx";

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
