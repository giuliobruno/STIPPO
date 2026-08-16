-- Scrub any Google OAuth tokens previously persisted for login linking.
UPDATE "Account"
SET
  "access_token" = NULL,
  "refresh_token" = NULL,
  "id_token" = NULL,
  "expires_at" = NULL,
  "session_state" = NULL
WHERE "provider" = 'google';
