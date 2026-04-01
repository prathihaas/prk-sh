-- ============================================================
-- Migration 023: Add per-approver tracking columns to expenses
-- ============================================================
-- These columns record WHO approved each stage and WHEN,
-- enabling the print voucher to show approver names + timestamps.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS branch_approved_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accounts_approved_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounts_approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_approved_by       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_approved_at       TIMESTAMPTZ;

-- Index for joining approver profiles
CREATE INDEX IF NOT EXISTS idx_expenses_branch_approved_by   ON expenses(branch_approved_by)   WHERE branch_approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_accounts_approved_by ON expenses(accounts_approved_by) WHERE accounts_approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_owner_approved_by    ON expenses(owner_approved_by)    WHERE owner_approved_by IS NOT NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
