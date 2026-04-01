-- ============================================================
-- Migration 020: Cashbook Transfers (Internal Money Transfers)
-- ============================================================
-- Allows moving money between cashbooks within a company.
-- Requires accountant approval before funds are debited/credited.
-- ============================================================

-- Enum for transfer status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cashbook_transfer_status') THEN
    CREATE TYPE cashbook_transfer_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Main table
CREATE TABLE IF NOT EXISTS cashbook_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id           UUID REFERENCES branches(id),
  financial_year_id   UUID REFERENCES financial_years(id),

  from_cashbook_id    UUID NOT NULL REFERENCES cashbooks(id),
  to_cashbook_id      UUID NOT NULL REFERENCES cashbooks(id),

  amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description         TEXT NOT NULL,
  transfer_date       DATE NOT NULL,

  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason       TEXT,

  -- Who created and who approved
  created_by          UUID REFERENCES user_profiles(id),
  approved_by         UUID REFERENCES user_profiles(id),
  approved_at         TIMESTAMPTZ,

  -- Links to the actual cashbook transactions created on approval
  from_txn_id         UUID REFERENCES cashbook_transactions(id),
  to_txn_id           UUID REFERENCES cashbook_transactions(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_transfer CHECK (from_cashbook_id <> to_cashbook_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cashbook_transfers_company  ON cashbook_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_transfers_status   ON cashbook_transfers(status);
CREATE INDEX IF NOT EXISTS idx_cashbook_transfers_date     ON cashbook_transfers(transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_cashbook_transfers_from_cb  ON cashbook_transfers(from_cashbook_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_transfers_to_cb    ON cashbook_transfers(to_cashbook_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_cashbook_transfers
  BEFORE UPDATE ON cashbook_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE cashbook_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY cashbook_transfers_tenant_isolation ON cashbook_transfers
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
        AND ua.company_id IS NOT NULL
    )
  );
