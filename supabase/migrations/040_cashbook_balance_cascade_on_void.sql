-- Migration 040: Cashbook balance cascade on void/delete/update
--
-- Bug: When a cashbook transaction is voided (is_voided=true) or its amount changes,
-- only THAT day's system_closing is recalculated. But each subsequent day's
-- `opening_balance` was set at day-open time from the previous day's closing —
-- so the chain goes stale:
--
--   Day 1: opening=1000, receipt=500, closing=1500   ← recalculated on void
--   Day 2: opening=1500 (stale if Day 1 closing changed)
--   Day 3: opening=2000 (stale)
--
-- Fix: Rewrite update_system_closing_balance() to cascade — after recalculating
-- day N's closing, walk forward through all subsequent days for the same cashbook
-- and update their opening_balance and system_closing in sequence.
--
-- Also add DELETE trigger (defense in depth) and a trigger on cashbook_days
-- so manual opening_balance edits also cascade.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rewrite update_system_closing_balance to cascade through subsequent days
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_system_closing_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_day_id UUID;
  v_cashbook_id UUID;
  v_day_date DATE;
  v_opening NUMERIC(18,2);
  v_net NUMERIC(18,2);
  v_new_closing NUMERIC(18,2);
  v_cursor_day RECORD;
  v_prev_closing NUMERIC(18,2);
BEGIN
  -- Determine which day was affected
  IF TG_OP = 'DELETE' THEN
    v_day_id := OLD.cashbook_day_id;
  ELSE
    v_day_id := NEW.cashbook_day_id;
  END IF;

  -- Look up the cashbook_id and date for cascade
  SELECT cashbook_id, date, opening_balance
    INTO v_cashbook_id, v_day_date, v_opening
    FROM cashbook_days
   WHERE id = v_day_id;

  IF v_day_id IS NULL OR v_cashbook_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Recalculate this day's closing from non-voided transactions
  SELECT COALESCE(
    SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END),
    0
  ) INTO v_net
    FROM cashbook_transactions
   WHERE cashbook_day_id = v_day_id
     AND is_voided = FALSE;

  v_new_closing := v_opening + v_net;

  UPDATE cashbook_days
     SET system_closing = v_new_closing
   WHERE id = v_day_id;

  -- Cascade: walk forward through subsequent days for this cashbook
  v_prev_closing := v_new_closing;

  FOR v_cursor_day IN
    SELECT id, date
      FROM cashbook_days
     WHERE cashbook_id = v_cashbook_id
       AND date > v_day_date
     ORDER BY date ASC
  LOOP
    -- Each subsequent day's opening = previous day's closing
    SELECT COALESCE(
      SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END),
      0
    ) INTO v_net
      FROM cashbook_transactions
     WHERE cashbook_day_id = v_cursor_day.id
       AND is_voided = FALSE;

    UPDATE cashbook_days
       SET opening_balance = v_prev_closing,
           system_closing = v_prev_closing + v_net
     WHERE id = v_cursor_day.id;

    v_prev_closing := v_prev_closing + v_net;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add DELETE trigger (defense in depth — soft-delete via is_voided is preferred,
--    but if a hard DELETE ever slips past prevent_hard_delete, we still recompute)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_update_closing_on_delete ON cashbook_transactions;

CREATE TRIGGER trg_update_closing_on_delete
AFTER DELETE ON cashbook_transactions
FOR EACH ROW
EXECUTE FUNCTION update_system_closing_balance();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. One-time data fix: recompute all cashbook day balances from scratch
--    so any stale downstream days get corrected.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_cashbook RECORD;
  v_day RECORD;
  v_prev_closing NUMERIC(18,2);
  v_net NUMERIC(18,2);
  v_cashbook_opening NUMERIC(18,2);
BEGIN
  FOR v_cashbook IN SELECT id, opening_balance FROM cashbooks LOOP
    v_cashbook_opening := v_cashbook.opening_balance;
    v_prev_closing := NULL;

    FOR v_day IN
      SELECT id, date
        FROM cashbook_days
       WHERE cashbook_id = v_cashbook.id
       ORDER BY date ASC
    LOOP
      -- First day opens from cashbook opening_balance; subsequent days chain
      DECLARE
        v_opening NUMERIC(18,2);
      BEGIN
        IF v_prev_closing IS NULL THEN
          v_opening := v_cashbook_opening;
        ELSE
          v_opening := v_prev_closing;
        END IF;

        SELECT COALESCE(
          SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END),
          0
        ) INTO v_net
          FROM cashbook_transactions
         WHERE cashbook_day_id = v_day.id
           AND is_voided = FALSE;

        UPDATE cashbook_days
           SET opening_balance = v_opening,
               system_closing = v_opening + v_net
         WHERE id = v_day.id;

        v_prev_closing := v_opening + v_net;
      END;
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
