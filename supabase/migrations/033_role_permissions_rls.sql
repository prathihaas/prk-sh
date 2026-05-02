-- ============================================================
-- Migration 033: Add INSERT/DELETE RLS policies for role_permissions
-- ============================================================
-- role_permissions only had a SELECT policy. Any attempt by Owner/Admin
-- to save role permission changes failed with:
--   "new row violates row-level security policy for table role_permissions"
-- Fix: allow owners (hierarchy 1) and group_fc/admin (hierarchy 2) to
-- insert and delete role_permissions rows.
-- The application layer (roles.ts) also uses supabaseAdmin as belt+suspenders.
-- ============================================================

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow Owner and Admin (hierarchy <= 2) to grant permissions to roles
DROP POLICY IF EXISTS "role_permissions_insert" ON role_permissions;
CREATE POLICY "role_permissions_insert" ON role_permissions
    FOR INSERT WITH CHECK (
        get_user_min_hierarchy_level(auth.uid()) <= 2
    );

-- Allow Owner and Admin to revoke permissions from roles
DROP POLICY IF EXISTS "role_permissions_delete" ON role_permissions;
CREATE POLICY "role_permissions_delete" ON role_permissions
    FOR DELETE USING (
        get_user_min_hierarchy_level(auth.uid()) <= 2
    );
