-- 2026-04-26: Per-client budgets
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- It is idempotent (IF NOT EXISTS / IF EXISTS) so re-running is safe.
--
-- Model:
--   * client_id IS NULL  -> firm-wide default budget for that category
--   * client_id IS NOT NULL -> per-client override for that category
--
-- The application reads per-client budgets first; if a client has none, it
-- falls back to the firm-wide defaults.
-- =============================================================================

ALTER TABLE category_budgets
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_category_budgets_firm_client
  ON category_budgets (firm_id, client_id);

-- Optional: enforce one row per (firm, client, category). Skip if your
-- existing constraint name doesn't match — list it from
--   SELECT conname FROM pg_constraint WHERE conrelid = 'category_budgets'::regclass;
-- and drop/recreate explicitly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'category_budgets'::regclass
      AND conname = 'category_budgets_firm_client_category_unique'
  ) THEN
    ALTER TABLE category_budgets
      ADD CONSTRAINT category_budgets_firm_client_category_unique
      UNIQUE (firm_id, client_id, category);
  END IF;
END $$;
