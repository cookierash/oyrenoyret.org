-- Convert existing credits from display value to cents (credits < 1000 assumed to be old display values)
UPDATE "User" SET credits = credits * 100 WHERE credits < 1000;
