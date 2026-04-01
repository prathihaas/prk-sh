-- Migration 027: Gate Incharge role
-- A branch-level role for security / gate staff responsible for
-- vehicle register entry. Limited to vehicle_register permissions only.

INSERT INTO roles (name, description, hierarchy_level, is_system)
VALUES (
  'gate_incharge',
  'Responsible for vehicle gate entry and registration at the branch. Can register arriving vehicles and update vehicle status only.',
  5,
  false
)
ON CONFLICT (name) DO NOTHING;

-- Grant both vehicle_register permissions to gate_incharge
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'gate_incharge'
  AND p.module = 'vehicle_register'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
