-- 2026-05-02: Per-receipt chat threads
-- =============================================================================
-- Run this once in Supabase Studio's SQL editor (or via psql).
-- Idempotent — safe to re-run.
--
-- Adds:
--   * conversations.receipt_id  UUID NULL — when set, the conversation is
--     anchored to a specific receipt. The accountant + the receipt's
--     client see full chat. The firm_admin can read but not post (the
--     application enforces that — RLS just lets them read).
--   * Index on receipt_id for the receipt-detail page's "open thread for
--     this receipt" lookup.
--
-- ON DELETE SET NULL on the FK so deleting a receipt doesn't nuke the
-- chat history; the conversation simply loses its receipt anchor and
-- stays in the firm's general thread list.
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_receipt_idx
  ON conversations (receipt_id)
  WHERE receipt_id IS NOT NULL;
