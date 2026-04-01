-- ============================================================
-- Migration 028: Tally Prime Export Infrastructure
-- Tracks export batches for audit trail and idempotency.
-- Tally ledger mappings are stored in company_configs.
-- ============================================================

-- ── Export Batch Tracking ─────────────────────────────────────
CREATE TABLE tally_export_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id     UUID REFERENCES branches(id) ON DELETE SET NULL,
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  voucher_count INTEGER NOT NULL DEFAULT 0,
  exported_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  exported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  filename      TEXT,
  notes         TEXT
);

CREATE INDEX idx_tally_export_batches_company ON tally_export_batches (company_id);
CREATE INDEX idx_tally_export_batches_date    ON tally_export_batches (from_date, to_date);

ALTER TABLE tally_export_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tally_export_read ON tally_export_batches
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_assignments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tally_export_insert ON tally_export_batches
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_assignments WHERE user_id = auth.uid()
    )
  );

-- ── Comments ──────────────────────────────────────────────────
COMMENT ON TABLE tally_export_batches IS
  'Audit trail of every Tally Prime XML export. Ledger mapping config stored in company_configs with config_key=''tally_settings''.';
