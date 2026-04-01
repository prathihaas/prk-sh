-- Migration 026: Vehicle Register Workshop/Bodyshop Enhancement
-- Adds shop_type, workshop-specific status tracking, and job comments

-- 1. Add new values to vehicle_register_status enum
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'ro_opened';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'waiting_for_parts';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'parts_received';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'insurance_approved';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'work_in_progress';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'work_done';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'ready_for_delivery';
ALTER TYPE vehicle_register_status ADD VALUE IF NOT EXISTS 'gate_pass_issued';

-- 2. Add workshop-specific columns to vehicle_register
ALTER TABLE vehicle_register
  ADD COLUMN IF NOT EXISTS shop_type          TEXT NOT NULL DEFAULT 'workshop'
    CHECK (shop_type IN ('workshop', 'bodyshop')),
  ADD COLUMN IF NOT EXISTS ro_number          TEXT,
  ADD COLUMN IF NOT EXISTS ro_opened_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_insurance_claim BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insurance_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_done_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gate_pass_issued_at TIMESTAMPTZ;

-- 3. Create vehicle_job_comments table
CREATE TABLE IF NOT EXISTS vehicle_job_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_register(id) ON DELETE CASCADE,
  comment    TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_job_comments_vehicle
  ON vehicle_job_comments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_job_comments_created_at
  ON vehicle_job_comments(created_at DESC);

-- 4. RLS for vehicle_job_comments
ALTER TABLE vehicle_job_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_job_comments_access" ON vehicle_job_comments
  USING (
    vehicle_id IN (
      SELECT id FROM vehicle_register vr
      WHERE vr.company_id IN (
        SELECT DISTINCT COALESCE(ua.company_id, c.id)
        FROM user_assignments ua
        JOIN companies c ON c.group_id = (
          SELECT group_id FROM user_assignments ua2
          WHERE ua2.user_id = auth.uid() LIMIT 1
        )
        WHERE ua.user_id = auth.uid() AND ua.is_active = true
      )
    )
  );

-- 5. Index for shop_type filtering on vehicle_register
CREATE INDEX IF NOT EXISTS idx_vehicle_register_shop_type
  ON vehicle_register(company_id, shop_type, status);

NOTIFY pgrst, 'reload schema';
