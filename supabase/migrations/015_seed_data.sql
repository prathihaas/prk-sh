-- ============================================================
-- Migration 015: Seed Data
-- Roles, Permissions, Role-Permission Mappings
-- ============================================================

-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (id, name, description, hierarchy_level, is_system) VALUES
    ('10000000-0000-0000-0000-000000000001', 'owner',
     'Group Owner — full system access', 1, TRUE),
    ('10000000-0000-0000-0000-000000000002', 'group_finance_controller',
     'Group Finance Controller — cross-company financial oversight', 2, TRUE),
    ('10000000-0000-0000-0000-000000000003', 'company_accountant',
     'Company Accountant — company-level financial management', 3, TRUE),
    ('10000000-0000-0000-0000-000000000004', 'branch_manager',
     'Branch Manager — branch-level operations', 4, TRUE),
    ('10000000-0000-0000-0000-000000000005', 'cashier',
     'Cashier — transaction entry and day operations', 5, TRUE),
    ('10000000-0000-0000-0000-000000000006', 'hr_manager',
     'HR Manager — employee and payroll management', 6, TRUE),
    ('10000000-0000-0000-0000-000000000007', 'employee',
     'Employee — self-service access only', 7, TRUE);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (id, module, action, description) VALUES
    -- Cashbook permissions
    ('20000000-0000-0000-0000-000000000001', 'cashbook', 'create', 'Create new cashbook'),
    ('20000000-0000-0000-0000-000000000002', 'cashbook', 'read', 'View cashbook and transactions'),
    ('20000000-0000-0000-0000-000000000003', 'cashbook', 'read_all_company', 'View all cashbooks in company'),
    ('20000000-0000-0000-0000-000000000004', 'cashbook', 'create_transaction', 'Create transactions'),
    ('20000000-0000-0000-0000-000000000005', 'cashbook', 'void_transaction', 'Void transactions'),
    ('20000000-0000-0000-0000-000000000006', 'cashbook', 'close_day', 'Close cashbook day'),
    ('20000000-0000-0000-0000-000000000007', 'cashbook', 'reopen_day', 'Reopen closed cashbook day'),
    ('20000000-0000-0000-0000-000000000008', 'cashbook', 'approve_variance', 'Approve cash variance'),

    -- Invoice permissions
    ('20000000-0000-0000-0000-000000000010', 'invoice', 'create', 'Create invoice record'),
    ('20000000-0000-0000-0000-000000000011', 'invoice', 'read', 'View invoices'),
    ('20000000-0000-0000-0000-000000000012', 'invoice', 'approve_accounts', 'Accounts approval on invoice'),
    ('20000000-0000-0000-0000-000000000013', 'invoice', 'approve_manager', 'Manager approval on invoice'),
    ('20000000-0000-0000-0000-000000000014', 'invoice', 'allow_delivery', 'Mark invoice for delivery'),
    ('20000000-0000-0000-0000-000000000015', 'invoice', 'cancel', 'Cancel invoice'),

    -- Expense permissions
    ('20000000-0000-0000-0000-000000000020', 'expense', 'submit', 'Submit expense claim'),
    ('20000000-0000-0000-0000-000000000021', 'expense', 'approve_branch', 'Branch-level expense approval'),
    ('20000000-0000-0000-0000-000000000022', 'expense', 'approve_accounts', 'Accounts-level expense approval'),
    ('20000000-0000-0000-0000-000000000023', 'expense', 'approve_owner', 'Owner-level expense approval'),

    -- HR permissions
    ('20000000-0000-0000-0000-000000000030', 'hr', 'manage_employees', 'Create/edit employees'),
    ('20000000-0000-0000-0000-000000000031', 'hr', 'mark_attendance', 'Mark daily attendance'),
    ('20000000-0000-0000-0000-000000000032', 'hr', 'close_attendance', 'Close attendance period'),
    ('20000000-0000-0000-0000-000000000033', 'hr', 'view_own_payslip', 'View own payslip'),

    -- Payroll permissions
    ('20000000-0000-0000-0000-000000000040', 'payroll', 'process', 'Process payroll run'),
    ('20000000-0000-0000-0000-000000000041', 'payroll', 'lock', 'Lock payroll after processing'),
    ('20000000-0000-0000-0000-000000000042', 'payroll', 'reopen', 'Reopen locked payroll'),
    ('20000000-0000-0000-0000-000000000043', 'payroll', 'export', 'Export salary sheet'),

    -- Admin permissions
    ('20000000-0000-0000-0000-000000000050', 'admin', 'manage_companies', 'Create/edit companies'),
    ('20000000-0000-0000-0000-000000000051', 'admin', 'manage_branches', 'Create/edit branches'),
    ('20000000-0000-0000-0000-000000000052', 'admin', 'manage_users', 'Manage user assignments'),
    ('20000000-0000-0000-0000-000000000053', 'admin', 'manage_custom_fields', 'Manage custom field definitions'),
    ('20000000-0000-0000-0000-000000000054', 'admin', 'view_audit_log', 'View audit log'),
    ('20000000-0000-0000-0000-000000000055', 'admin', 'view_fraud_flags', 'View fraud detection flags'),
    ('20000000-0000-0000-0000-000000000056', 'admin', 'lock_financial_year', 'Lock financial year'),
    ('20000000-0000-0000-0000-000000000057', 'admin', 'configure_approval_matrix', 'Configure approval workflows'),

    -- Reporting permissions
    ('20000000-0000-0000-0000-000000000060', 'reporting', 'group_reports', 'View group consolidated reports'),
    ('20000000-0000-0000-0000-000000000061', 'reporting', 'company_reports', 'View company-level reports'),
    ('20000000-0000-0000-0000-000000000062', 'reporting', 'branch_reports', 'View branch-level reports');

-- ============================================================
-- ROLE ↔ PERMISSION MAPPING
-- ============================================================

-- Helper: Owner gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000001'::UUID,
    id
FROM permissions;

-- Group Finance Controller
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000002'::UUID,
    id
FROM permissions
WHERE (module, action) IN (
    ('cashbook', 'create'),
    ('cashbook', 'read'),
    ('cashbook', 'read_all_company'),
    ('cashbook', 'void_transaction'),
    ('cashbook', 'close_day'),
    ('cashbook', 'reopen_day'),
    ('cashbook', 'approve_variance'),
    ('invoice', 'read'),
    ('invoice', 'approve_accounts'),
    ('invoice', 'approve_manager'),
    ('invoice', 'allow_delivery'),
    ('invoice', 'cancel'),
    ('expense', 'submit'),
    ('expense', 'approve_branch'),
    ('expense', 'approve_accounts'),
    ('payroll', 'process'),
    ('payroll', 'lock'),
    ('payroll', 'reopen'),
    ('payroll', 'export'),
    ('admin', 'manage_branches'),
    ('admin', 'manage_users'),
    ('admin', 'manage_custom_fields'),
    ('admin', 'view_audit_log'),
    ('admin', 'view_fraud_flags'),
    ('admin', 'lock_financial_year'),
    ('admin', 'configure_approval_matrix'),
    ('reporting', 'group_reports'),
    ('reporting', 'company_reports'),
    ('reporting', 'branch_reports'),
    ('hr', 'view_own_payslip')
);

-- Company Accountant
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000003'::UUID,
    id
FROM permissions
WHERE (module, action) IN (
    ('cashbook', 'create'),
    ('cashbook', 'read'),
    ('cashbook', 'read_all_company'),
    ('cashbook', 'create_transaction'),
    ('cashbook', 'void_transaction'),
    ('cashbook', 'close_day'),
    ('cashbook', 'approve_variance'),
    ('invoice', 'create'),
    ('invoice', 'read'),
    ('invoice', 'approve_accounts'),
    ('invoice', 'allow_delivery'),
    ('expense', 'submit'),
    ('expense', 'approve_accounts'),
    ('payroll', 'process'),
    ('payroll', 'lock'),
    ('payroll', 'export'),
    ('admin', 'manage_custom_fields'),
    ('admin', 'view_audit_log'),
    ('admin', 'view_fraud_flags'),
    ('reporting', 'company_reports'),
    ('reporting', 'branch_reports'),
    ('hr', 'view_own_payslip')
);

-- Branch Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000004'::UUID,
    id
FROM permissions
WHERE (module, action) IN (
    ('cashbook', 'read'),
    ('cashbook', 'create_transaction'),
    ('cashbook', 'close_day'),
    ('invoice', 'create'),
    ('invoice', 'read'),
    ('invoice', 'approve_manager'),
    ('invoice', 'allow_delivery'),
    ('expense', 'submit'),
    ('expense', 'approve_branch'),
    ('hr', 'mark_attendance'),
    ('hr', 'close_attendance'),
    ('hr', 'view_own_payslip'),
    ('admin', 'view_audit_log'),
    ('reporting', 'branch_reports')
);

-- Cashier
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000005'::UUID,
    id
FROM permissions
WHERE (module, action) IN (
    ('cashbook', 'read'),
    ('cashbook', 'create_transaction'),
    ('cashbook', 'close_day'),
    ('invoice', 'create'),
    ('invoice', 'read'),
    ('expense', 'submit'),
    ('hr', 'view_own_payslip')
);

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000006'::UUID,
    id
FROM permissions
WHERE (module, action) IN (
    ('hr', 'manage_employees'),
    ('hr', 'mark_attendance'),
    ('hr', 'close_attendance'),
    ('hr', 'view_own_payslip'),
    ('payroll', 'process'),
    ('expense', 'submit')
);

-- Employee
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '10000000-0000-0000-0000-000000000007'::UUID,
    id
FROM permissions
WHERE (module, action) IN (
    ('expense', 'submit'),
    ('hr', 'view_own_payslip')
);
