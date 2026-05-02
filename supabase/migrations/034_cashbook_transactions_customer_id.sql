-- ============================================================
-- Migration 034: Add customer_id to cashbook_transactions
-- ============================================================
-- The customer_id column was added to invoices in migration 019
-- but was omitted from cashbook_transactions, causing a schema
-- cache error when creating receipts that reference a customer.
-- ============================================================

ALTER TABLE cashbook_transactions
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_transactions_customer_id
  ON cashbook_transactions(customer_id);

-- Reload PostgREST schema cache so the new column is visible immediately
NOTIFY pgrst, 'reload schema';
