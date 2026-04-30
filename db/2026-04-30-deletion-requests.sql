-- 2026-04-30: Receipt deletion requests
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- Idempotent (IF NOT EXISTS / IF EXISTS) so re-running is safe.
--
-- Model:
--   Clients can request that a receipt be deleted. Only accountants /
--   firm_admins can approve, at which point the receipt row + everything
--   that cascades off it (items, taxes, flags, edits, files) is gone.
--   Owner accounts can approve only when their edit-mode toggle is on.
--
-- Lifecycle: pending -> approved | denied
-- =============================================================================

CREATE TABLE IF NOT EXISTS deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id      UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  firm_id         UUID NOT NULL REFERENCES firms(id)    ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'denied')),
  decided_by      UUID REFERENCES auth.users(id),
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  -- Snapshot of the receipt at request time so the row is still readable
  -- after the receipt has been deleted on approval.
  receipt_vendor  TEXT,
  receipt_date    DATE,
  receipt_total_cents INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deletion_requests_firm_status_idx
  ON deletion_requests (firm_id, status);

CREATE INDEX IF NOT EXISTS deletion_requests_receipt_idx
  ON deletion_requests (receipt_id);

-- Only one pending request per receipt at a time. Approved/denied rows are
-- kept as history and don't block a new request if the receipt still exists.
CREATE UNIQUE INDEX IF NOT EXISTS deletion_requests_one_pending_per_receipt
  ON deletion_requests (receipt_id)
  WHERE status = 'pending';

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- Members of the firm can read their firm's requests.
DROP POLICY IF EXISTS deletion_requests_select ON deletion_requests;
CREATE POLICY deletion_requests_select ON deletion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM firm_users fu
      WHERE fu.firm_id = deletion_requests.firm_id
        AND fu.auth_user_id = auth.uid()
    )
  );

-- Clients can request deletion of their own receipts; staff can also create
-- requests on behalf of clients.
DROP POLICY IF EXISTS deletion_requests_insert ON deletion_requests;
CREATE POLICY deletion_requests_insert ON deletion_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM firm_users fu
      WHERE fu.firm_id = deletion_requests.firm_id
        AND fu.auth_user_id = auth.uid()
    )
    AND requested_by = auth.uid()
  );

-- Only accountants / firm_admins / owners can update (approve/deny). The
-- application enforces the further rule that owners must be in edit mode.
DROP POLICY IF EXISTS deletion_requests_update ON deletion_requests;
CREATE POLICY deletion_requests_update ON deletion_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM firm_users fu
      WHERE fu.firm_id = deletion_requests.firm_id
        AND fu.auth_user_id = auth.uid()
        AND fu.role IN ('accountant', 'firm_admin', 'owner')
    )
  );
