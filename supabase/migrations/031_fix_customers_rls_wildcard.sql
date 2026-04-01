-- Fix customers RLS: old policy used raw IN subquery that returns NULL for owner
-- (company_id = NULL in user_assignments → NULL IN (...) = false in SQL)
-- Replace with get_user_accessible_companies() which handles wildcard correctly.

DROP POLICY IF EXISTS customers_company_isolation ON public.customers;

CREATE POLICY customers_company_isolation ON public.customers
  FOR ALL
  USING (company_id = ANY(get_user_accessible_companies(auth.uid())))
  WITH CHECK (company_id = ANY(get_user_accessible_companies(auth.uid())));
