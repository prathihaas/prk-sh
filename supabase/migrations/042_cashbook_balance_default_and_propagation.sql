-- 042: Make opening/closing balances correct for empty days, and propagate
--      edits to cashbooks.opening_balance through to the first day's chain.
--
-- Problems being fixed:
--   1. cashbook_days.system_closing was NULL for any day that had not yet
--      received a transaction, so the UI displayed "—" for closing balance
--      and variance was unusable (physical_count - NULL = NULL).
--   2. Editing the cashbooks.opening_balance after a day already existed
--      did not flow into the day_opening / system_closing chain — the very
--      first day kept its stale opening forever.

-- ── 1. Default system_closing = opening_balance on insert ────────────────
CREATE OR REPLACE FUNCTION public.cashbook_day_default_closing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.system_closing IS NULL THEN
    NEW.system_closing := NEW.opening_balance;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashbook_day_default_closing ON public.cashbook_days;
CREATE TRIGGER trg_cashbook_day_default_closing
  BEFORE INSERT ON public.cashbook_days
  FOR EACH ROW EXECUTE FUNCTION public.cashbook_day_default_closing();

-- ── 2. When cashbook.opening_balance is edited, restamp the first day and
--      cascade the chain forward ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.propagate_cashbook_opening_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_first_day_id UUID;
  v_first_date DATE;
  v_net NUMERIC(18,2);
  v_prev_closing NUMERIC(18,2);
  v_cursor RECORD;
BEGIN
  IF NEW.opening_balance IS NOT DISTINCT FROM OLD.opening_balance THEN
    RETURN NEW;
  END IF;

  SELECT id, date INTO v_first_day_id, v_first_date
    FROM cashbook_days
   WHERE cashbook_id = NEW.id
   ORDER BY date ASC
   LIMIT 1;

  IF v_first_day_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END), 0
  ) INTO v_net
    FROM cashbook_transactions
   WHERE cashbook_day_id = v_first_day_id
     AND is_voided = FALSE;

  UPDATE cashbook_days
     SET opening_balance = NEW.opening_balance,
         system_closing  = NEW.opening_balance + v_net
   WHERE id = v_first_day_id;

  v_prev_closing := NEW.opening_balance + v_net;

  FOR v_cursor IN
    SELECT id, date
      FROM cashbook_days
     WHERE cashbook_id = NEW.id
       AND date > v_first_date
     ORDER BY date ASC
  LOOP
    SELECT COALESCE(
      SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END), 0
    ) INTO v_net
      FROM cashbook_transactions
     WHERE cashbook_day_id = v_cursor.id
       AND is_voided = FALSE;

    UPDATE cashbook_days
       SET opening_balance = v_prev_closing,
           system_closing  = v_prev_closing + v_net
     WHERE id = v_cursor.id;

    v_prev_closing := v_prev_closing + v_net;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_cashbook_opening_balance ON public.cashbooks;
CREATE TRIGGER trg_propagate_cashbook_opening_balance
  AFTER UPDATE OF opening_balance ON public.cashbooks
  FOR EACH ROW EXECUTE FUNCTION public.propagate_cashbook_opening_balance();

-- ── 3. Backfill existing NULL system_closing values ──────────────────────
UPDATE public.cashbook_days cd
SET system_closing = cd.opening_balance + (
  SELECT COALESCE(
    SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END), 0
  )
  FROM public.cashbook_transactions
  WHERE cashbook_day_id = cd.id
    AND is_voided = FALSE
)
WHERE cd.system_closing IS NULL;
