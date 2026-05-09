-- 053: Performance fixes targeting Disk-IO budget exhaustion.
--
-- Two parts:
--   A. Composite indexes for the hot read paths the receipts/payments and
--      expenses lists run on every page load.
--   B. Move the four AFTER-INSERT fraud-detection triggers off the hot
--      write path. Each one used to scan cashbook_transactions /
--      cashbook_days inline on every receipt save (~2,500 blocks/insert).
--      Now we just enqueue a (transaction_id, kind) row into a slim queue
--      table; a separate cron worker drains them.

-- ── A. Composite indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_list_hot
  ON public.cashbook_transactions (company_id, branch_id, txn_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_txn_company_voided_date
  ON public.cashbook_transactions (company_id, is_voided, created_at DESC)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS idx_expenses_list_hot
  ON public.expenses (company_id, branch_id, approval_status, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_active
  ON public.user_profiles (is_active, full_name)
  WHERE is_active = true;

-- ── B. Async fraud-detection queue ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_check_queue (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.cashbook_transactions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('backdated','off_hours','rapid','threshold')),
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fraud_check_queue_pending
  ON public.fraud_check_queue (enqueued_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.fraud_check_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fraud_check_queue_service_only ON public.fraud_check_queue;
CREATE POLICY fraud_check_queue_service_only
  ON public.fraud_check_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.enqueue_fraud_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.fraud_check_queue (transaction_id, kind)
  SELECT NEW.id, k
  FROM unnest(ARRAY['backdated','off_hours','rapid','threshold']) AS k;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_backdated_entry ON public.cashbook_transactions;
DROP TRIGGER IF EXISTS trg_detect_off_hours ON public.cashbook_transactions;
DROP TRIGGER IF EXISTS trg_detect_rapid_transactions ON public.cashbook_transactions;
DROP TRIGGER IF EXISTS trg_detect_threshold_breach ON public.cashbook_transactions;

DROP TRIGGER IF EXISTS trg_enqueue_fraud_checks ON public.cashbook_transactions;
CREATE TRIGGER trg_enqueue_fraud_checks
  AFTER INSERT ON public.cashbook_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_fraud_checks();

COMMENT ON TABLE public.fraud_check_queue IS
  'Async work queue for fraud-detection rules. A cron worker drains pending rows and runs the matching detect_* function per row, then sets processed_at.';
