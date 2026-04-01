-- ============================================================
-- Migration 022: Missing Permissions
-- ============================================================
-- Migration 015 seeded permissions for: cashbook, invoice,
-- expense, hr, payroll, admin, reporting.
--
-- These modules were built later and their permissions were
-- never inserted into the DB:
--   customer, purchase, transfer, cashbook_transfer,
--   asset, bank, receipt (extra actions), expense (extra actions)
--
-- This migration also wires them up to the appropriate roles.
-- ============================================================

-- -------------------------------------------------------
-- 1. Insert missing permissions
-- -------------------------------------------------------
INSERT INTO permissions (module, action, description) VALUES
  -- Customer
  ('customer', 'create',            'Create customers'),
  ('customer', 'read',              'View customers'),
  ('customer', 'update',            'Edit customer details'),

  -- Purchase
  ('purchase', 'view',              'View purchase invoices'),
  ('purchase', 'create',            'Create purchase invoices'),
  ('purchase', 'import',            'Bulk import purchases'),

  -- Branch Transfers (goods)
  ('transfer', 'view',              'View branch transfer requests'),
  ('transfer', 'create',            'Create branch transfer requests'),
  ('transfer', 'receive',           'Receive / acknowledge branch transfers'),
  ('transfer', 'challan',           'Generate and manage transfer challans'),

  -- Cashbook Transfers (internal money between cashbooks)
  ('cashbook_transfer', 'view',     'View cashbook transfer requests'),
  ('cashbook_transfer', 'create',   'Initiate cashbook transfers'),
  ('cashbook_transfer', 'approve',  'Approve or reject cashbook transfers'),

  -- Asset Register
  ('asset', 'view',                 'View assets and history'),
  ('asset', 'create',               'Register new assets'),
  ('asset', 'update',               'Edit asset details'),
  ('asset', 'audit',                'Conduct asset physical audits'),
  ('asset', 'assign',               'Assign assets to employees'),

  -- Bank
  ('bank', 'read',                  'View bank accounts and statements'),
  ('bank', 'create',                'Add new bank accounts'),
  ('bank', 'close',                 'Close bank accounts'),
  ('bank', 'reopen',                'Reopen closed bank accounts'),

  -- Receipt (extra actions)
  ('receipt', 'backdate',           'Create backdated receipts'),
  ('receipt', 'delete',             'Delete / void receipts'),

  -- Expense (extra actions not in migration 015)
  ('expense', 'pay_direct',         'Pay expense directly without approval'),
  ('expense', 'approve_owner',      'Owner-level expense approval')

ON CONFLICT (module, action) DO NOTHING;

-- -------------------------------------------------------
-- 2. Owner gets ALL permissions (including new ones above)
-- -------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id
FROM permissions
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- 3. Group Finance Controller — new permissions
-- -------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id
FROM permissions
WHERE (module, action) IN (
  ('customer',           'read'),
  ('purchase',           'view'),
  ('transfer',           'view'),
  ('cashbook_transfer',  'view'),
  ('cashbook_transfer',  'approve'),
  ('asset',              'view'),
  ('bank',               'read'),
  ('bank',               'reopen')
)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- 4. Company Accountant — new permissions
-- -------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id
FROM permissions
WHERE (module, action) IN (
  ('customer',           'create'),
  ('customer',           'read'),
  ('customer',           'update'),
  ('purchase',           'view'),
  ('purchase',           'create'),
  ('purchase',           'import'),
  ('transfer',           'view'),
  ('transfer',           'create'),
  ('transfer',           'receive'),
  ('cashbook_transfer',  'view'),
  ('cashbook_transfer',  'create'),
  ('asset',              'view'),
  ('asset',              'create'),
  ('asset',              'update'),
  ('asset',              'audit'),
  ('asset',              'assign'),
  ('bank',               'read'),
  ('bank',               'create'),
  ('bank',               'close'),
  ('bank',               'reopen'),
  ('receipt',            'backdate'),
  ('expense',            'pay_direct')
)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- 5. Branch Manager — new permissions
-- -------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id
FROM permissions
WHERE (module, action) IN (
  ('customer',           'create'),
  ('customer',           'read'),
  ('purchase',           'view'),
  ('purchase',           'create'),
  ('transfer',           'view'),
  ('transfer',           'create'),
  ('transfer',           'receive'),
  ('transfer',           'challan'),
  ('asset',              'view'),
  ('asset',              'audit'),
  ('asset',              'assign'),
  ('bank',               'read')
)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- 6. Cashier — new permissions
-- -------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000005', id
FROM permissions
WHERE (module, action) IN (
  ('customer',           'create'),
  ('customer',           'read'),
  ('transfer',           'receive'),
  ('transfer',           'challan'),
  ('bank',               'read')
)
ON CONFLICT DO NOTHING;
