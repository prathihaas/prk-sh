-- 043: Drop the legacy hierarchical approval-chain trigger and replace it
--      with a slim timestamp-only one.
--
-- The application moved to single-stage expense approval — any owner /
-- finance controller / accountant / branch manager (for that branch) can
-- approve an expense once and it becomes payable. But the database still
-- carried enforce_expense_approval_chain(), which raised
--   "Expense must be accounts_approved before owner approval."
-- whenever submitted -> owner_approved was attempted in one hop, breaking
-- every approval click after the refactor.
--
-- We drop the trigger + its dependent function and replace it with a slim
-- BEFORE-UPDATE trigger that only stamps the matching *_at column.

DROP TRIGGER IF EXISTS trg_expense_approval_chain ON public.expenses;
DROP TRIGGER IF EXISTS trg_enforce_expense_approval_chain ON public.expenses;
DROP FUNCTION IF EXISTS public.enforce_expense_approval_chain() CASCADE;

CREATE OR REPLACE FUNCTION public.stamp_expense_approval_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    CASE NEW.approval_status
      WHEN 'branch_approved'   THEN NEW.branch_approved_at   := COALESCE(NEW.branch_approved_at,   NOW());
      WHEN 'accounts_approved' THEN NEW.accounts_approved_at := COALESCE(NEW.accounts_approved_at, NOW());
      WHEN 'owner_approved'    THEN NEW.owner_approved_at    := COALESCE(NEW.owner_approved_at,    NOW());
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_expense_approval_timestamps ON public.expenses;
CREATE TRIGGER trg_stamp_expense_approval_timestamps
  BEFORE UPDATE OF approval_status ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.stamp_expense_approval_timestamps();
