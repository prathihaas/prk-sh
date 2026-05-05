-- 051: Add R/O number and receipt-type columns to cashbook_transactions.
-- Both are optional metadata used in dealership workflows:
--   - ro_number: Repair Order number from the workshop DMS, useful when
--     the receipt is for a service / body-shop / insurance job.
--   - receipt_type: business category for the receipt
--     (new_car, used_car, service, bodyshop, insurance_renewal, counter_sales).

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS ro_number text,
  ADD COLUMN IF NOT EXISTS receipt_type text;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_ro_number
  ON public.cashbook_transactions (company_id, ro_number)
  WHERE ro_number IS NOT NULL;

COMMENT ON COLUMN public.cashbook_transactions.ro_number IS
  'Repair Order number from the workshop DMS — typed in by user, no uniqueness enforced (multiple receipts may reference the same RO).';
COMMENT ON COLUMN public.cashbook_transactions.receipt_type IS
  'Business category: new_car | used_car | service | bodyshop | insurance_renewal | counter_sales. Free text for forward-compat.';
