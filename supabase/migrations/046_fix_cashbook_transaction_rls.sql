-- 046: Fix cashbook_transactions RLS so transactions can actually be saved.
--
-- Two defects in the existing policies:
--   1. txn_insert checked user_has_permission('cashbook','create') — that
--      grants the right to create a NEW CASHBOOK ACCOUNT, not to record
--      a transaction. The transaction permission is 'cashbook'/'create_transaction'.
--      Cashiers and branch_managers (the two roles that actually record
--      transactions) only have create_transaction, so every txn save by
--      either role hit "row violates row-level security policy".
--   2. txn_insert / txn_select / txn_update used `branch_id = ANY(...)`
--      which returns NULL (not true) when branch_id is NULL. A
--      company-level / multi-branch bank transaction with branch_id IS NULL
--      could never satisfy the policy.

DROP POLICY IF EXISTS txn_insert ON public.cashbook_transactions;
DROP POLICY IF EXISTS txn_select ON public.cashbook_transactions;
DROP POLICY IF EXISTS txn_update ON public.cashbook_transactions;

CREATE POLICY txn_insert
  ON public.cashbook_transactions
  FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (
      branch_id IS NULL
      OR branch_id = ANY (get_user_accessible_branches(auth.uid()))
    )
    AND user_has_permission(auth.uid(), 'cashbook'::text, 'create_transaction'::text)
  );

CREATE POLICY txn_select
  ON public.cashbook_transactions
  FOR SELECT
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (
      branch_id IS NULL
      OR branch_id = ANY (get_user_accessible_branches(auth.uid()))
    )
  );

CREATE POLICY txn_update
  ON public.cashbook_transactions
  FOR UPDATE
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (
      branch_id IS NULL
      OR branch_id = ANY (get_user_accessible_branches(auth.uid()))
    )
  );
