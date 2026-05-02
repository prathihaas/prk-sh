-- 047: Make every policy that uses `branch_id = ANY(get_user_accessible_branches(...))`
-- NULL-safe by switching to `(branch_id IS NULL OR branch_id = ANY(...))`.
--
-- A NULL branch_id (company-level bank account, company-wide expense,
-- company-wide approval request, etc.) used to fail every check because
-- `NULL = ANY(...)` evaluates to NULL (not true) and Postgres treats that
-- as policy denied. Same root-cause as the cashbook_transactions fix in 046.
--
-- This migration only relaxes the branch check; it does not touch
-- company_id checks or permission gates.

-- approval_requests
DROP POLICY IF EXISTS approval_req_insert ON public.approval_requests;
DROP POLICY IF EXISTS approval_req_select ON public.approval_requests;
DROP POLICY IF EXISTS approval_req_update ON public.approval_requests;

CREATE POLICY approval_req_insert ON public.approval_requests FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY approval_req_select ON public.approval_requests FOR SELECT
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY approval_req_update ON public.approval_requests FOR UPDATE
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );

-- approval_steps
DROP POLICY IF EXISTS approval_steps_select ON public.approval_steps;
DROP POLICY IF EXISTS approval_steps_update ON public.approval_steps;

CREATE POLICY approval_steps_select ON public.approval_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM approval_requests ar
    WHERE ar.id = approval_steps.request_id
      AND ar.company_id = ANY (get_user_accessible_companies(auth.uid()))
      AND (ar.branch_id IS NULL OR ar.branch_id = ANY (get_user_accessible_branches(auth.uid())))
  ));
CREATE POLICY approval_steps_update ON public.approval_steps FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM approval_requests ar
    WHERE ar.id = approval_steps.request_id
      AND ar.company_id = ANY (get_user_accessible_companies(auth.uid()))
      AND (ar.branch_id IS NULL OR ar.branch_id = ANY (get_user_accessible_branches(auth.uid())))
  ));

-- cashbook_days
DROP POLICY IF EXISTS cashbook_days_insert ON public.cashbook_days;
DROP POLICY IF EXISTS cashbook_days_select ON public.cashbook_days;
DROP POLICY IF EXISTS cashbook_days_update ON public.cashbook_days;

CREATE POLICY cashbook_days_insert ON public.cashbook_days FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY cashbook_days_select ON public.cashbook_days FOR SELECT
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY cashbook_days_update ON public.cashbook_days FOR UPDATE
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );

-- expenses
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_update ON public.expenses;

CREATE POLICY expenses_insert ON public.expenses FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY expenses_select ON public.expenses FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR (
      company_id = ANY (get_user_accessible_companies(auth.uid()))
      AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
      AND get_user_min_hierarchy_level(auth.uid()) <= 4
    )
  );
CREATE POLICY expenses_update ON public.expenses FOR UPDATE
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
    AND (submitted_by = auth.uid() OR get_user_min_hierarchy_level(auth.uid()) <= 4)
  );

-- invoices
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;

CREATE POLICY invoices_insert ON public.invoices FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
    AND user_has_permission(auth.uid(), 'invoice'::text, 'create'::text)
  );
CREATE POLICY invoices_select ON public.invoices FOR SELECT
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY invoices_update ON public.invoices FOR UPDATE
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );

-- invoice_payments
DROP POLICY IF EXISTS inv_payments_insert ON public.invoice_payments;
DROP POLICY IF EXISTS inv_payments_select ON public.invoice_payments;

CREATE POLICY inv_payments_insert ON public.invoice_payments FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY inv_payments_select ON public.invoice_payments FOR SELECT
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );

-- purchase_invoices
DROP POLICY IF EXISTS purchase_invoices_insert ON public.purchase_invoices;
DROP POLICY IF EXISTS purchase_invoices_update ON public.purchase_invoices;

CREATE POLICY purchase_invoices_insert ON public.purchase_invoices FOR INSERT
  WITH CHECK (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
CREATE POLICY purchase_invoices_update ON public.purchase_invoices FOR UPDATE
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );

-- transaction_revisions
DROP POLICY IF EXISTS revisions_select ON public.transaction_revisions;

CREATE POLICY revisions_select ON public.transaction_revisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM cashbook_transactions ct
    WHERE ct.id = transaction_revisions.transaction_id
      AND ct.company_id = ANY (get_user_accessible_companies(auth.uid()))
      AND (ct.branch_id IS NULL OR ct.branch_id = ANY (get_user_accessible_branches(auth.uid())))
  ));

-- receipt_number_series
DROP POLICY IF EXISTS receipt_series_select ON public.receipt_number_series;
CREATE POLICY receipt_series_select ON public.receipt_number_series FOR SELECT
  USING (
    company_id = ANY (get_user_accessible_companies(auth.uid()))
    AND (branch_id IS NULL OR branch_id = ANY (get_user_accessible_branches(auth.uid())))
  );
