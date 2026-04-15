-- Migration 041: Add rejection audit columns to expenses
--
-- Companion to the expense rejection fix in frontend/src/lib/queries/expenses.ts.
-- Previously rejectExpense() only saved rejection_reason with no state guard
-- and no audit trail of who/when. Now we track who rejected and when.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
