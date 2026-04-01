-- ============================================================
-- Migration 011: Row-Level Security Policies for ALL tables
-- ============================================================
-- Strategy:
--   - Every table with company_id: filtered by accessible companies
--   - Branch-scoped tables: additionally filtered by accessible branches
--   - audit_log: read-only to users with audit permission
--   - Service role bypasses RLS (for triggers and admin functions)
-- ============================================================

-- ========================
-- GROUPS
-- ========================
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select" ON groups
    FOR SELECT USING (
        id = ANY(get_user_group_ids(auth.uid()))
    );

CREATE POLICY "groups_insert" ON groups
    FOR INSERT WITH CHECK (
        get_user_min_hierarchy_level(auth.uid()) = 1  -- Owner only
    );

CREATE POLICY "groups_update" ON groups
    FOR UPDATE USING (
        id = ANY(get_user_group_ids(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) = 1
    );

-- ========================
-- COMPANIES
-- ========================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select" ON companies
    FOR SELECT USING (
        id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "companies_insert" ON companies
    FOR INSERT WITH CHECK (
        get_user_min_hierarchy_level(auth.uid()) = 1
        AND group_id = ANY(get_user_group_ids(auth.uid()))
    );

CREATE POLICY "companies_update" ON companies
    FOR UPDATE USING (
        id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

-- ========================
-- BRANCHES
-- ========================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select" ON branches
    FOR SELECT USING (
        id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "branches_insert" ON branches
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

CREATE POLICY "branches_update" ON branches
    FOR UPDATE USING (
        id = ANY(get_user_accessible_branches(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

-- ========================
-- FINANCIAL YEARS
-- ========================
ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fy_select" ON financial_years
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "fy_insert" ON financial_years
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

CREATE POLICY "fy_update" ON financial_years
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

-- ========================
-- USER PROFILES
-- ========================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can always see their own profile
-- Managers and above can see profiles of users in their scope
CREATE POLICY "profiles_select" ON user_profiles
    FOR SELECT USING (
        id = auth.uid()
        OR get_user_min_hierarchy_level(auth.uid()) <= 4
    );

CREATE POLICY "profiles_update" ON user_profiles
    FOR UPDATE USING (
        id = auth.uid()
    );

-- ========================
-- USER ASSIGNMENTS
-- ========================
ALTER TABLE user_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_select" ON user_assignments
    FOR SELECT USING (
        user_id = auth.uid()
        OR group_id = ANY(get_user_group_ids(auth.uid()))
    );

-- Only Owner and Group FC can manage assignments
CREATE POLICY "assignments_insert" ON user_assignments
    FOR INSERT WITH CHECK (
        get_user_min_hierarchy_level(auth.uid()) <= 2
        AND group_id = ANY(get_user_group_ids(auth.uid()))
    );

CREATE POLICY "assignments_update" ON user_assignments
    FOR UPDATE USING (
        get_user_min_hierarchy_level(auth.uid()) <= 2
        AND group_id = ANY(get_user_group_ids(auth.uid()))
    );

-- ========================
-- CASHBOOKS
-- ========================
ALTER TABLE cashbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashbooks_select" ON cashbooks
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "cashbooks_insert" ON cashbooks
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'cashbook', 'create')
    );

CREATE POLICY "cashbooks_update" ON cashbooks
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

-- ========================
-- CASHBOOK DAYS
-- ========================
ALTER TABLE cashbook_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashbook_days_select" ON cashbook_days
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "cashbook_days_insert" ON cashbook_days
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "cashbook_days_update" ON cashbook_days
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- ========================
-- CASHBOOK TRANSACTIONS
-- ========================
ALTER TABLE cashbook_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "txn_select" ON cashbook_transactions
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "txn_insert" ON cashbook_transactions
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'cashbook', 'create')
    );

CREATE POLICY "txn_update" ON cashbook_transactions
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- No DELETE policy — enforced by trigger (block all deletes)

-- ========================
-- TRANSACTION REVISIONS
-- ========================
ALTER TABLE transaction_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revisions_select" ON transaction_revisions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cashbook_transactions ct
            WHERE ct.id = transaction_revisions.transaction_id
              AND ct.company_id = ANY(get_user_accessible_companies(auth.uid()))
              AND ct.branch_id = ANY(get_user_accessible_branches(auth.uid()))
        )
    );

CREATE POLICY "revisions_insert" ON transaction_revisions
    FOR INSERT WITH CHECK (TRUE);  -- Controlled by trigger, not direct user insertion

-- ========================
-- INVOICES
-- ========================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "invoices_insert" ON invoices
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'invoice', 'create')
    );

CREATE POLICY "invoices_update" ON invoices
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- ========================
-- INVOICE PAYMENTS
-- ========================
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_payments_select" ON invoice_payments
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "inv_payments_insert" ON invoice_payments
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- ========================
-- EXPENSE CATEGORIES
-- ========================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_cat_select" ON expense_categories
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "expense_cat_insert" ON expense_categories
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

CREATE POLICY "expense_cat_update" ON expense_categories
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

-- ========================
-- EXPENSES
-- ========================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses
    FOR SELECT USING (
        -- Users can see their own submissions OR expenses in their scope
        submitted_by = auth.uid()
        OR (
            company_id = ANY(get_user_accessible_companies(auth.uid()))
            AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
            AND get_user_min_hierarchy_level(auth.uid()) <= 4
        )
    );

CREATE POLICY "expenses_insert" ON expenses
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "expenses_update" ON expenses
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND (
            submitted_by = auth.uid()
            OR get_user_min_hierarchy_level(auth.uid()) <= 4
        )
    );

-- ========================
-- CUSTOM FIELD DEFINITIONS
-- ========================
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfd_select" ON custom_field_definitions
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "cfd_insert" ON custom_field_definitions
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

CREATE POLICY "cfd_update" ON custom_field_definitions
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

-- ========================
-- CUSTOM FIELD VALUES
-- ========================
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfv_select" ON custom_field_values
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "cfv_insert" ON custom_field_values
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "cfv_update" ON custom_field_values
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

-- ========================
-- EMPLOYEES
-- ========================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select" ON employees
    FOR SELECT USING (
        -- Employee can see own record
        user_id = auth.uid()
        OR (
            company_id = ANY(get_user_accessible_companies(auth.uid()))
            AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
            AND get_user_min_hierarchy_level(auth.uid()) <= 6  -- HR Manager+
        )
    );

CREATE POLICY "employees_insert" ON employees
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'manage_employees')
    );

CREATE POLICY "employees_update" ON employees
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'manage_employees')
    );

-- ========================
-- ATTENDANCE PERIODS
-- ========================
ALTER TABLE attendance_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_periods_select" ON attendance_periods
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "att_periods_insert" ON attendance_periods
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'mark_attendance')
    );

CREATE POLICY "att_periods_update" ON attendance_periods
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- ========================
-- ATTENDANCE RECORDS
-- ========================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_records_select" ON attendance_records
    FOR SELECT USING (
        -- Employee sees own attendance
        EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = attendance_records.employee_id
              AND e.user_id = auth.uid()
        )
        OR (
            company_id = ANY(get_user_accessible_companies(auth.uid()))
            AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
            AND get_user_min_hierarchy_level(auth.uid()) <= 6
        )
    );

CREATE POLICY "att_records_insert" ON attendance_records
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'mark_attendance')
    );

CREATE POLICY "att_records_update" ON attendance_records
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'mark_attendance')
    );

-- ========================
-- LEAVE BALANCES
-- ========================
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_bal_select" ON leave_balances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = leave_balances.employee_id
              AND e.user_id = auth.uid()
        )
        OR (
            company_id = ANY(get_user_accessible_companies(auth.uid()))
            AND get_user_min_hierarchy_level(auth.uid()) <= 6
        )
    );

CREATE POLICY "leave_bal_insert" ON leave_balances
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'manage_employees')
    );

CREATE POLICY "leave_bal_update" ON leave_balances
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'hr', 'manage_employees')
    );

-- ========================
-- PAYROLL RUNS
-- ========================
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_select" ON payroll_runs
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 6
    );

CREATE POLICY "payroll_runs_insert" ON payroll_runs
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
        AND user_has_permission(auth.uid(), 'payroll', 'process')
    );

CREATE POLICY "payroll_runs_update" ON payroll_runs
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- ========================
-- PAYROLL ENTRIES
-- ========================
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_entries_select" ON payroll_entries
    FOR SELECT USING (
        -- Employee sees own payslip
        EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = payroll_entries.employee_id
              AND e.user_id = auth.uid()
        )
        OR (
            company_id = ANY(get_user_accessible_companies(auth.uid()))
            AND get_user_min_hierarchy_level(auth.uid()) <= 6
        )
    );

CREATE POLICY "payroll_entries_insert" ON payroll_entries
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'payroll', 'process')
    );

CREATE POLICY "payroll_entries_update" ON payroll_entries
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'payroll', 'process')
    );

-- ========================
-- APPROVAL MATRIX
-- ========================
ALTER TABLE approval_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_matrix_select" ON approval_matrix
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "approval_matrix_insert" ON approval_matrix
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

CREATE POLICY "approval_matrix_update" ON approval_matrix
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

-- ========================
-- APPROVAL REQUESTS
-- ========================
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_req_select" ON approval_requests
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "approval_req_insert" ON approval_requests
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "approval_req_update" ON approval_requests
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- ========================
-- APPROVAL STEPS
-- ========================
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_steps_select" ON approval_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar
            WHERE ar.id = approval_steps.request_id
              AND ar.company_id = ANY(get_user_accessible_companies(auth.uid()))
              AND ar.branch_id = ANY(get_user_accessible_branches(auth.uid()))
        )
    );

CREATE POLICY "approval_steps_update" ON approval_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar
            WHERE ar.id = approval_steps.request_id
              AND ar.company_id = ANY(get_user_accessible_companies(auth.uid()))
              AND ar.branch_id = ANY(get_user_accessible_branches(auth.uid()))
        )
    );

-- ========================
-- AUDIT LOG — Read-only, permission-gated
-- ========================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'admin', 'view_audit_log')
    );

-- INSERT allowed only from service role (triggers)
-- No UPDATE/DELETE policies — enforced by immutability triggers

-- ========================
-- FRAUD FLAGS
-- ========================
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_flags_select" ON fraud_flags
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'admin', 'view_fraud_flags')
    );

CREATE POLICY "fraud_flags_update" ON fraud_flags
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND user_has_permission(auth.uid(), 'admin', 'view_fraud_flags')
    );

-- ========================
-- COMPANY CONFIGS
-- ========================
ALTER TABLE company_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_configs_select" ON company_configs
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "company_configs_insert" ON company_configs
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

CREATE POLICY "company_configs_update" ON company_configs
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 2
    );

-- ========================
-- RECEIPT NUMBER SERIES
-- ========================
ALTER TABLE receipt_number_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_series_select" ON receipt_number_series
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "receipt_series_insert" ON receipt_number_series
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

CREATE POLICY "receipt_series_update" ON receipt_number_series
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND get_user_min_hierarchy_level(auth.uid()) <= 3
    );

-- ========================
-- ROLES & PERMISSIONS (read by all authenticated, write by admins)
-- ========================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select" ON roles FOR SELECT USING (TRUE);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_select" ON permissions FOR SELECT USING (TRUE);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT USING (TRUE);
