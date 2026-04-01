-- ============================================================
-- Migration 021: Asset Register
-- ============================================================
-- Tracks company physical assets (equipment, vehicles, tools).
-- Supports km readings for vehicles, condition audits, and
-- employee assignment history.
-- ============================================================

-- -------------------------------------------------------
-- 1. ASSET CATEGORIES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_asset_categories_company ON asset_categories(company_id);

ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_categories_tenant_isolation ON asset_categories
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
        AND ua.company_id IS NOT NULL
    )
  );

-- -------------------------------------------------------
-- 2. ASSETS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id           UUID REFERENCES branches(id),
  category_id         UUID REFERENCES asset_categories(id),

  asset_code          TEXT NOT NULL,
  -- Unique token embedded in QR code for field scanning
  qr_token            TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  name                TEXT NOT NULL,
  description         TEXT,
  is_vehicle          BOOLEAN NOT NULL DEFAULT false,

  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'under_maintenance', 'disposed', 'lost')),

  -- Financial / depreciation
  purchase_date       DATE,
  purchase_value      NUMERIC(15,2),
  useful_life_years   INTEGER CHECK (useful_life_years BETWEEN 1 AND 99),
  salvage_value       NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Vehicle tracking
  current_km_reading  INTEGER CHECK (current_km_reading >= 0),

  -- Current assignment (denormalised for fast lookup)
  assigned_to         UUID REFERENCES employees(id),
  assigned_at         TIMESTAMPTZ,

  -- Latest audit snapshot (denormalised)
  last_audit_date     DATE,
  last_audit_by       UUID REFERENCES user_profiles(id),
  audit_condition     TEXT CHECK (audit_condition IN ('excellent', 'good', 'fair', 'poor', 'needs_repair')),

  created_by          UUID REFERENCES user_profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (company_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_assets_company     ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_branch      ON assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_category    ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status      ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_qr_token    ON assets(qr_token);

CREATE TRIGGER set_updated_at_assets
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_tenant_isolation ON assets
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
        AND ua.company_id IS NOT NULL
    )
  );

-- -------------------------------------------------------
-- 3. ASSET KM READINGS (vehicle odometer log)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_km_readings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  reading_date  DATE NOT NULL,
  km_reading    INTEGER NOT NULL CHECK (km_reading >= 0),
  notes         TEXT,
  recorded_by   UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_km_readings_asset ON asset_km_readings(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_km_readings_date  ON asset_km_readings(reading_date DESC);

ALTER TABLE asset_km_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_km_readings_isolation ON asset_km_readings
  USING (
    asset_id IN (
      SELECT a.id FROM assets a
      WHERE a.company_id IN (
        SELECT ua.company_id
        FROM user_assignments ua
        WHERE ua.user_id = auth.uid()
          AND ua.company_id IS NOT NULL
      )
    )
  );

-- -------------------------------------------------------
-- 4. ASSET AUDITS (physical verification records)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_audits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  audited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  condition   TEXT NOT NULL CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'needs_repair')),
  km_reading  INTEGER CHECK (km_reading >= 0),
  notes       TEXT,
  audited_by  UUID REFERENCES user_profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_audits_asset      ON asset_audits(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_audits_audited_at ON asset_audits(audited_at DESC);

ALTER TABLE asset_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_audits_isolation ON asset_audits
  USING (
    asset_id IN (
      SELECT a.id FROM assets a
      WHERE a.company_id IN (
        SELECT ua.company_id
        FROM user_assignments ua
        WHERE ua.user_id = auth.uid()
          AND ua.company_id IS NOT NULL
      )
    )
  );

-- -------------------------------------------------------
-- 5. ASSET ASSIGNMENTS (employee custody history)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at   TIMESTAMPTZ,
  notes         TEXT,
  assigned_by   UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset    ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee ON asset_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_open     ON asset_assignments(asset_id) WHERE returned_at IS NULL;

ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_assignments_isolation ON asset_assignments
  USING (
    asset_id IN (
      SELECT a.id FROM assets a
      WHERE a.company_id IN (
        SELECT ua.company_id
        FROM user_assignments ua
        WHERE ua.user_id = auth.uid()
          AND ua.company_id IS NOT NULL
      )
    )
  );
