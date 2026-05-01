-- 2026-05-01: Fiscal year reports
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- Idempotent — safe to re-run.
--
-- Adds:
--   * clients.fiscal_year_end_month  — int 1..12, default 12 (Dec).
--     Sole props default to a calendar year; corporations may have any.
--     The fiscal-year report aggregates the 12 months ENDING in this month.
--   * client_reports.report_type     — text, default 'monthly'. New rows
--     for fiscal-year aggregates store 'fiscal_year' here so they don't
--     collide with monthly reports at the unique-key level.
--
-- Replaces the old (client_id, report_month) unique constraint with
-- (client_id, report_month, report_type) so a client can have a January
-- monthly report AND a fiscal-year report dated in January coexisting.
-- =============================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS fiscal_year_end_month INTEGER NOT NULL DEFAULT 12
  CHECK (fiscal_year_end_month BETWEEN 1 AND 12);

ALTER TABLE client_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'monthly'
  CHECK (report_type IN ('monthly', 'fiscal_year'));

-- Drop the old unique key (whatever it's named) and replace with one that
-- includes report_type so a fiscal_year report dated in March doesn't
-- collide with the March monthly report.
DO $$
DECLARE
  old_constraint TEXT;
BEGIN
  SELECT conname INTO old_constraint
  FROM pg_constraint
  WHERE conrelid = 'client_reports'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(client_id, report_month)%'
  LIMIT 1;
  IF old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE client_reports DROP CONSTRAINT %I', old_constraint);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'client_reports'::regclass
      AND conname = 'client_reports_client_month_type_key'
  ) THEN
    ALTER TABLE client_reports
      ADD CONSTRAINT client_reports_client_month_type_key
      UNIQUE (client_id, report_month, report_type);
  END IF;
END $$;
