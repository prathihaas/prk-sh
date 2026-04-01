-- ============================================================
-- Migration 001: Extensions, Custom Types, and Core Helpers
-- ============================================================
-- System: Enterprise Financial Control & HR Platform
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CUSTOM ENUM TYPES
-- ============================================================

CREATE TYPE cashbook_type AS ENUM ('main', 'petty', 'bank');

CREATE TYPE cashbook_day_status AS ENUM ('open', 'closing', 'closed', 'reopened');

CREATE TYPE txn_type AS ENUM ('receipt', 'payment');

CREATE TYPE payment_mode AS ENUM (
    'cash', 'cheque', 'upi', 'bank_transfer', 'card', 'finance'
);

CREATE TYPE invoice_type AS ENUM (
    'automobile_sale', 'tractor_agri_sale', 'service'
);

CREATE TYPE invoice_approval_status AS ENUM (
    'pending', 'accounts_approved', 'manager_approved', 'rejected'
);

CREATE TYPE expense_approval_status AS ENUM (
    'draft', 'submitted', 'branch_approved',
    'accounts_approved', 'owner_approved', 'rejected'
);

CREATE TYPE employee_status AS ENUM (
    'active', 'on_notice', 'exited', 'terminated', 'suspended'
);

CREATE TYPE attendance_status AS ENUM (
    'present', 'absent', 'half_day', 'leave', 'holiday', 'weekly_off'
);

CREATE TYPE period_status AS ENUM ('open', 'closing', 'closed');

CREATE TYPE payroll_status AS ENUM (
    'draft', 'processing', 'processed', 'locked', 'reopened'
);

CREATE TYPE leave_type AS ENUM (
    'casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid'
);

CREATE TYPE approval_entity_type AS ENUM (
    'invoice', 'expense', 'cashbook_reopen', 'payment_mode_change',
    'high_value_txn', 'refund', 'payroll_reopen',
    'attendance_close', 'variance_approval', 'void_transaction'
);

CREATE TYPE approval_status AS ENUM (
    'pending', 'in_progress', 'approved', 'rejected', 'cancelled'
);

CREATE TYPE approval_step_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE revision_approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE audit_action AS ENUM (
    'INSERT', 'UPDATE', 'VOID', 'CLOSE', 'REOPEN',
    'APPROVE', 'REJECT', 'LOGIN', 'EXPORT', 'LOCK', 'UNLOCK'
);

CREATE TYPE fraud_flag_type AS ENUM (
    'repeated_receipt_edit', 'high_cash_variance', 'backdated_entry',
    'manual_override', 'unusual_void_pattern', 'threshold_breach',
    'off_hours_activity', 'rapid_transactions'
);

CREATE TYPE fraud_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE custom_field_type AS ENUM (
    'text', 'number', 'dropdown', 'date', 'boolean'
);

CREATE TYPE custom_field_entity AS ENUM (
    'cashbook', 'receipt', 'payment', 'invoice', 'expense'
);

-- ============================================================
-- UTILITY FUNCTION: updated_at auto-setter
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
