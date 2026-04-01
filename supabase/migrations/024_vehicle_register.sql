-- ============================================================
-- Migration 024: Vehicle Register + Sales Receipt Flag
-- ============================================================

-- 1. Add is_sales_receipt flag to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_sales_receipt BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Enum for vehicle tracking status
DO $$ BEGIN
  CREATE TYPE vehicle_register_status AS ENUM (
    'arrived', 'billed', 'challan_issued', 'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Vehicle Register table
CREATE TABLE IF NOT EXISTS vehicle_register (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id             UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  financial_year_id     UUID REFERENCES financial_years(id),

  -- Vehicle identity
  vehicle_type          TEXT NOT NULL DEFAULT 'automobile',  -- automobile | tractor | two_wheeler | other
  make                  TEXT,                                -- Manufacturer
  model                 TEXT NOT NULL,
  variant               TEXT,
  color                 TEXT,
  year_of_manufacture   INTEGER,
  vin_number            TEXT,
  chassis_number        TEXT,
  engine_number         TEXT,
  registration_number   TEXT,

  -- Status tracking
  status                vehicle_register_status NOT NULL DEFAULT 'arrived',

  -- Customer (denormalized name for quick display)
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name         TEXT,

  -- Billing link (set when invoice is created for this vehicle)
  invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Stage timestamps
  arrived_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  billed_at             TIMESTAMPTZ,
  challan_issued_at     TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,

  -- Delivery tracking
  expected_delivery_date DATE,
  delay_reason          TEXT,
  notes                 TEXT,

  -- Audit
  created_by            UUID REFERENCES user_profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_register_company ON vehicle_register(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_register_branch  ON vehicle_register(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_register_status  ON vehicle_register(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_register_invoice ON vehicle_register(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_register_customer ON vehicle_register(customer_id) WHERE customer_id IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER trg_vehicle_register_updated_at
  BEFORE UPDATE ON vehicle_register
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. RLS
ALTER TABLE vehicle_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_register_company_access" ON vehicle_register
  USING (
    company_id IN (
      SELECT DISTINCT COALESCE(ua.company_id, c.id)
      FROM user_assignments ua
      JOIN companies c ON c.group_id = (
        SELECT group_id FROM user_assignments ua2
        WHERE ua2.user_id = auth.uid() AND ua2.is_active = true
        LIMIT 1
      )
      WHERE ua.user_id = auth.uid() AND ua.is_active = true
    )
  );

-- 5. New permissions
INSERT INTO permissions (module, action, description) VALUES
  ('vehicle_register', 'view',   'View the vehicle register'),
  ('vehicle_register', 'manage', 'Add/update vehicles in the register')
ON CONFLICT (module, action) DO NOTHING;

-- Grant to Owner, Admin, Branch Manager, Company Accountant
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'vehicle_register'
  AND r.name IN ('owner', 'admin', 'branch_manager', 'company_accountant')
ON CONFLICT DO NOTHING;

-- 6. Sales receipt permission
INSERT INTO permissions (module, action, description) VALUES
  ('sales_receipt', 'create', 'Create a sales receipt (combined invoice + payment)'),
  ('sales_receipt', 'view',   'View sales receipts')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'sales_receipt'
  AND r.name IN ('owner', 'admin', 'branch_manager', 'company_accountant', 'cashier')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
