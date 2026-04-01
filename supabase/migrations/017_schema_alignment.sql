-- ============================================================
-- Migration 017: Schema alignment with frontend code
-- ============================================================
-- This migration aligns column names in the DB with what the
-- frontend code expects. No existing data is affected
-- (fresh deployment with no user-entered records).
-- ============================================================

-- ============================================================
-- 1. PURCHASE INVOICES — rename columns to match code
-- ============================================================

ALTER TABLE purchase_invoices RENAME COLUMN invoice_date        TO supplier_invoice_date;
ALTER TABLE purchase_invoices RENAME COLUMN base_amount          TO subtotal;
ALTER TABLE purchase_invoices RENAME COLUMN notes                TO narration;

-- Recreate the date index under the new column name
DROP INDEX IF EXISTS idx_purchase_inv_date;
CREATE INDEX idx_purchase_inv_date ON purchase_invoices(supplier_invoice_date);

-- ============================================================
-- 2. PURCHASE INVOICE ITEMS — rename + add missing columns
-- ============================================================

ALTER TABLE purchase_invoice_items RENAME COLUMN tax_rate TO tax_percent;
ALTER TABLE purchase_invoice_items ADD COLUMN IF NOT EXISTS sort_order SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE purchase_invoice_items ADD COLUMN IF NOT EXISTS unit TEXT;

-- ============================================================
-- 3. EXPENSES — add payment tracking columns missing from schema
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bill_reference          TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes                   TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_date            DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode            TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_via_cashbook_id    UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by                 UUID;

-- FK constraints named to match the hints used in the frontend queries
ALTER TABLE expenses
    ADD CONSTRAINT expenses_paid_via_cashbook_id_fkey
    FOREIGN KEY (paid_via_cashbook_id) REFERENCES cashbooks(id) ON DELETE SET NULL;

ALTER TABLE expenses
    ADD CONSTRAINT expenses_paid_by_fkey
    FOREIGN KEY (paid_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 4. FRAUD FLAGS — rename + add columns to match code
-- ============================================================

-- Rename existing columns to names the code expects
ALTER TABLE fraud_flags RENAME COLUMN user_id       TO flagged_by;
ALTER TABLE fraud_flags RENAME COLUMN reviewed_by   TO resolved_by;
ALTER TABLE fraud_flags RENAME COLUMN reviewed_at   TO resolved_at;
ALTER TABLE fraud_flags RENAME COLUMN review_notes  TO resolution_notes;

-- Add missing columns the code expects
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS flagged_at        TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS resolution_status TEXT        NOT NULL DEFAULT 'open';

ALTER TABLE fraud_flags
    ADD CONSTRAINT chk_fraud_resolution_status
    CHECK (resolution_status IN ('open', 'resolved', 'false_positive'));

-- FK constraints named to match frontend FK hints
ALTER TABLE fraud_flags
    ADD CONSTRAINT fraud_flags_flagged_by_fkey
    FOREIGN KEY (flagged_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

ALTER TABLE fraud_flags
    ADD CONSTRAINT fraud_flags_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 5. AUDIT LOG — no FK added
-- ============================================================
-- audit_log contains rows with user_id = 00000000-0000-0000-0000-000000000000
-- (system/trigger operations) so a FK to user_profiles cannot be added.
-- The frontend fetches audit log rows without joining user_profiles;
-- the code uses entity_type/entity_id/user_id as column names.
-- (no DDL needed here)
