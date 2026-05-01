-- 2026-04-30: Demo-data flagging for the immersive first-login tour
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- Idempotent — safe to re-run.
--
-- Adds is_demo BOOLEAN to the four tables the demo seeder writes:
--   * clients          — demo clients show up in the firm's client list
--   * firm_users       — placeholder demo accountant (no real auth user)
--   * receipts         — 15 demo receipts (5 per client)
--   * receipt_folders  — auto-created "[Demo]" folder receipts land in
--
-- Default FALSE means existing rows are unaffected. Indexes target the
-- two query shapes Sprint 5b uses:
--   * WHERE is_demo = TRUE   (cleanup, "Clear demo data" button)
--   * WHERE is_demo = FALSE  (export filter once any real receipt exists)
-- =============================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE firm_users
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE receipt_folders
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial indexes — we only ever scan for is_demo=TRUE in cleanup queries,
-- and the export filter is best served by a (firm_id, is_demo) index. The
-- default-false makes WHERE is_demo=FALSE the hot path for almost every
-- existing row.
CREATE INDEX IF NOT EXISTS clients_demo_idx
  ON clients (firm_id) WHERE is_demo = TRUE;

CREATE INDEX IF NOT EXISTS firm_users_demo_idx
  ON firm_users (firm_id) WHERE is_demo = TRUE;

CREATE INDEX IF NOT EXISTS receipts_demo_idx
  ON receipts (firm_id, is_demo);

CREATE INDEX IF NOT EXISTS receipt_folders_demo_idx
  ON receipt_folders (firm_id) WHERE is_demo = TRUE;
