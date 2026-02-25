-- Revert credits from cents back to display (credits >= 100 are assumed to be in cents)
UPDATE "User" SET credits = credits / 100 WHERE credits >= 100;
