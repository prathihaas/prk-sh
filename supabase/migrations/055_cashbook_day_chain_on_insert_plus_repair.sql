-- 055: When a cashbook_day is inserted (especially out-of-order — a date
-- earlier than existing days), the opening_balance must chain from the
-- *immediately preceding* day's closing, not from "latest by date desc",
-- and all later days must be re-chained from the new day's closing.
--
-- The transaction-level cascade only fires on txn insert/update/delete,
-- so a freshly inserted day with no transactions has whatever the caller
-- typed in as opening_balance and never gets re-chained until someone
-- adds a txn to it. This produced the bug where Cash NRM May 8 sat in
-- the middle of the chain with opening_balance 261,948 while May 7
-- closed at 142,959 — an unexplained jump.

-- ── BEFORE INSERT: chain opening from immediately preceding day ──────
CREATE OR REPLACE FUNCTION public.chain_cashbook_day_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_closing NUMERIC(18,2);
  v_cb_opening   NUMERIC(18,2);
  v_net          NUMERIC(18,2);
BEGIN
  SELECT COALESCE(system_closing, opening_balance) INTO v_prev_closing
    FROM cashbook_days
   WHERE cashbook_id = NEW.cashbook_id
     AND date < NEW.date
   ORDER BY date DESC
   LIMIT 1;

  IF v_prev_closing IS NULL THEN
    SELECT opening_balance INTO v_cb_opening
      FROM cashbooks WHERE id = NEW.cashbook_id;
    v_prev_closing := COALESCE(v_cb_opening, 0);
  END IF;

  NEW.opening_balance := v_prev_closing;

  SELECT COALESCE(SUM(CASE WHEN txn_type='receipt' THEN amount ELSE -amount END), 0)
    INTO v_net
    FROM cashbook_transactions
   WHERE cashbook_day_id = NEW.id AND is_voided = false;

  NEW.system_closing := v_prev_closing + v_net;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chain_cashbook_day_on_insert ON public.cashbook_days;
CREATE TRIGGER trg_chain_cashbook_day_on_insert
  BEFORE INSERT ON public.cashbook_days
  FOR EACH ROW EXECUTE FUNCTION public.chain_cashbook_day_on_insert();

-- ── AFTER INSERT: cascade forward through every later day ────────────
CREATE OR REPLACE FUNCTION public.recascade_cashbook_days_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_closing NUMERIC(18,2);
  v_net          NUMERIC(18,2);
  v_cursor       RECORD;
BEGIN
  v_prev_closing := NEW.system_closing;

  FOR v_cursor IN
    SELECT id, date FROM cashbook_days
     WHERE cashbook_id = NEW.cashbook_id
       AND date > NEW.date
     ORDER BY date ASC
  LOOP
    SELECT COALESCE(SUM(CASE WHEN txn_type='receipt' THEN amount ELSE -amount END), 0)
      INTO v_net
      FROM cashbook_transactions
     WHERE cashbook_day_id = v_cursor.id AND is_voided = false;

    UPDATE cashbook_days
       SET opening_balance = v_prev_closing,
           system_closing  = v_prev_closing + v_net
     WHERE id = v_cursor.id;

    v_prev_closing := v_prev_closing + v_net;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recascade_cashbook_days_after ON public.cashbook_days;
CREATE TRIGGER trg_recascade_cashbook_days_after
  AFTER INSERT ON public.cashbook_days
  FOR EACH ROW EXECUTE FUNCTION public.recascade_cashbook_days_after();

-- ── One-shot repair: rebuild every cashbook's chain from scratch ─────
DO $$
DECLARE
  cb              RECORD;
  v_prev_closing  NUMERIC(18,2);
  d               RECORD;
  v_net           NUMERIC(18,2);
BEGIN
  FOR cb IN SELECT id, opening_balance FROM cashbooks LOOP
    v_prev_closing := COALESCE(cb.opening_balance, 0);
    FOR d IN SELECT id, date FROM cashbook_days WHERE cashbook_id = cb.id ORDER BY date ASC LOOP
      SELECT COALESCE(SUM(CASE WHEN txn_type='receipt' THEN amount ELSE -amount END), 0)
        INTO v_net FROM cashbook_transactions WHERE cashbook_day_id = d.id AND is_voided = false;
      UPDATE cashbook_days
         SET opening_balance = v_prev_closing,
             system_closing  = v_prev_closing + v_net
       WHERE id = d.id;
      v_prev_closing := v_prev_closing + v_net;
    END LOOP;
  END LOOP;
END $$;
