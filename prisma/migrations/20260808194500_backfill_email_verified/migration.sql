-- Existing password accounts are treated as already verified so we don't lock anyone out.
UPDATE "User"
SET "emailVerified" = COALESCE("emailVerified", "createdAt")
WHERE "passwordHash" IS NOT NULL
  AND "emailVerified" IS NULL;
