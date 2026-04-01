-- ============================================================
-- Migration 032: Fix cashbooks RLS for bank accounts
-- ============================================================
-- Bank accounts (type = 'bank') are company-wide and have
-- branch_id = NULL. The original cashbooks_select policy uses:
--
--   branch_id = ANY(get_user_accessible_branches(auth.uid()))
--
-- NULL = ANY(array) is always FALSE/NULL in SQL, so bank accounts
-- were invisible to ALL users regardless of permissions.
--
-- Fix: allow branch_id IS NULL (bank accounts) to pass through.
-- ============================================================

-- Fix SELECT policy
DROP POLICY IF EXISTS "cashbooks_select" ON cashbooks;
CREATE POLICY "cashbooks_select" ON cashbooks
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND (
            branch_id IS NULL  -- Bank accounts are company-wide (no branch)
            OR branch_id = ANY(get_user_accessible_branches(auth.uid()))
        )
    );

-- Fix UPDATE policy (same issue)
DROP POLICY IF EXISTS "cashbooks_update" ON cashbooks;
CREATE POLICY "cashbooks_update" ON cashbooks
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND (
            branch_id IS NULL
            OR branch_id = ANY(get_user_accessible_branches(auth.uid()))
        )
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );
