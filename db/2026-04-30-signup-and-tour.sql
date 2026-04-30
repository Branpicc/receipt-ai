-- 2026-04-30: Self-serve signup, branded email verification, first-login tour
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- Idempotent (IF NOT EXISTS / IF EXISTS) so re-running is safe.
--
-- Adds:
--   * firms.created_via_self_serve     — flag for Sprint 2 Stripe backfill
--   * firm_users.email_verified_at     — set when user clicks verify link
--   * firm_users.tour_completed_at     — set when user finishes the wizard
--   * firm_users.tour_skipped_at       — set when user skips it
--   * email_verifications              — single-use tokens, 24h TTL
-- =============================================================================

ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS created_via_self_serve BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE firm_users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tour_skipped_at   TIMESTAMPTZ;

-- Existing users (invited team members, stress-test seed users, the user
-- running this migration) shouldn't be forced through email verification —
-- backfill them as already-verified at signup time so the banner doesn't
-- appear retroactively.
UPDATE firm_users
SET    email_verified_at = NOW()
WHERE  email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- For the resend rate-limit: time of the last send for this user.
  -- We just look up the most recent unconsumed token and check created_at.
  CONSTRAINT email_verifications_consumed_after_created
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX IF NOT EXISTS email_verifications_user_idx
  ON email_verifications (auth_user_id, created_at DESC);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- The user can read their own verification rows (for the dashboard banner
-- to show "verification pending" state). Writes happen via the service-role
-- key in /api/signup, /api/verify-email, /api/resend-verification.
DROP POLICY IF EXISTS email_verifications_select_self ON email_verifications;
CREATE POLICY email_verifications_select_self ON email_verifications
  FOR SELECT USING (auth_user_id = auth.uid());
