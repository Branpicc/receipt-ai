-- 2026-05-05: Daily check-in completions
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- Idempotent — safe to re-run.
--
-- One row per accountant per workday. The DailyCheckinRunner upserts on
-- (accountant_id, completion_date) as the user progresses through their
-- 5-minute check-in. completed_at is set when all three steps are done.
--
-- Step bookkeeping:
--   * receipts_categorized_today = count of receipts the accountant set
--     approved_category on TODAY. Computed on-demand from receipt_edits;
--     the column here is just a denormalized cache the runner can update
--     for fast firm-admin reads.
--   * email_inbox_visited_at, flags_reviewed_at = timestamps when the
--     accountant visited those pages during a check-in.
--   * step (text) tracks the runner's current position so the widget can
--     resume across navigations.
--
-- The completion_date is a DATE (no time component) so a single row
-- represents one workday regardless of how the user moves through it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_checklist_completions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  accountant_id                 UUID NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  completion_date               DATE NOT NULL,

  step                          TEXT NOT NULL DEFAULT 'idle'
                                CHECK (step IN ('idle','running','receipts','emails','flags','done')),

  receipts_categorized_today    INTEGER NOT NULL DEFAULT 0,
  email_inbox_visited_at        TIMESTAMPTZ,
  flags_reviewed_at             TIMESTAMPTZ,

  started_at                    TIMESTAMPTZ,
  completed_at                  TIMESTAMPTZ,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT daily_checklist_one_per_day UNIQUE (accountant_id, completion_date)
);

CREATE INDEX IF NOT EXISTS daily_checklist_firm_date_idx
  ON daily_checklist_completions (firm_id, completion_date DESC);

CREATE INDEX IF NOT EXISTS daily_checklist_accountant_date_idx
  ON daily_checklist_completions (accountant_id, completion_date DESC);

-- updated_at auto-touch via a tiny trigger so we don't need to set it
-- on every upsert in app code.
CREATE OR REPLACE FUNCTION touch_daily_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_checklist_touch_updated_at ON daily_checklist_completions;
CREATE TRIGGER daily_checklist_touch_updated_at
  BEFORE UPDATE ON daily_checklist_completions
  FOR EACH ROW
  EXECUTE FUNCTION touch_daily_checklist_updated_at();

ALTER TABLE daily_checklist_completions ENABLE ROW LEVEL SECURITY;

-- Members of the firm can read their firm's check-ins (so firm_admin can
-- see the team panel + leaderboard). Accountants can only read their own.
DROP POLICY IF EXISTS daily_checklist_select ON daily_checklist_completions;
CREATE POLICY daily_checklist_select ON daily_checklist_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM firm_users fu
      WHERE fu.firm_id = daily_checklist_completions.firm_id
        AND fu.auth_user_id = auth.uid()
        AND (
          fu.role IN ('firm_admin', 'owner')
          OR fu.id = daily_checklist_completions.accountant_id
        )
    )
  );

-- Accountants can insert/update their own row only.
DROP POLICY IF EXISTS daily_checklist_write ON daily_checklist_completions;
CREATE POLICY daily_checklist_write ON daily_checklist_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM firm_users fu
      WHERE fu.id = daily_checklist_completions.accountant_id
        AND fu.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM firm_users fu
      WHERE fu.id = daily_checklist_completions.accountant_id
        AND fu.auth_user_id = auth.uid()
    )
  );
