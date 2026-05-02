-- 049: Add UTR (Unique Transaction Reference) field to cashbook_transactions.
-- Required for receipts via UPI / bank transfer / card / finance (not cheque
-- or cash). UTR numbers issued by NPCI / banks are globally unique, so we
-- mirror that guarantee with a partial unique index — only enforced for
-- non-null, non-voided rows so void/redo flows aren't blocked.

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS utr_number text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cashbook_txn_utr
  ON public.cashbook_transactions (utr_number)
  WHERE utr_number IS NOT NULL AND is_voided = false;

COMMENT ON COLUMN public.cashbook_transactions.utr_number IS
  'Unique Transaction Reference for UPI / bank transfer / card / finance receipts. Globally unique across all companies (partial unique index when not voided). Null for cash and cheque.';
