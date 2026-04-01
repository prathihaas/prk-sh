-- ============================================================
-- Migration 010: RLS Helper Functions — Scope Resolution
-- ============================================================
-- These functions are called from RLS policies to determine
-- what data each user can access. They are marked STABLE
-- to allow PostgreSQL query planner optimization.
-- ============================================================

-- ============================================================
-- Get the group_id(s) a user belongs to
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_group_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        array_agg(DISTINCT group_id),
        '{}'::UUID[]
    )
    FROM user_assignments
    WHERE user_id = p_user_id
      AND is_active = TRUE;
$$;

-- ============================================================
-- Get all company IDs a user can access
-- If user has company_id = NULL → all companies in that group
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_accessible_companies(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        array_agg(DISTINCT c.id),
        '{}'::UUID[]
    )
    FROM user_assignments ua
    JOIN companies c ON c.group_id = ua.group_id
    WHERE ua.user_id = p_user_id
      AND ua.is_active = TRUE
      AND c.is_active = TRUE
      AND (ua.company_id IS NULL OR ua.company_id = c.id);
$$;

-- ============================================================
-- Get all branch IDs a user can access
-- If user has branch_id = NULL → all branches in accessible companies
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_accessible_branches(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        array_agg(DISTINCT b.id),
        '{}'::UUID[]
    )
    FROM user_assignments ua
    JOIN companies c ON c.group_id = ua.group_id
    JOIN branches b ON b.company_id = c.id
    WHERE ua.user_id = p_user_id
      AND ua.is_active = TRUE
      AND c.is_active = TRUE
      AND b.is_active = TRUE
      AND (ua.company_id IS NULL OR ua.company_id = c.id)
      AND (ua.branch_id IS NULL OR ua.branch_id = b.id);
$$;

-- ============================================================
-- Check if user has a specific permission
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_module TEXT,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_assignments ua
        JOIN role_permissions rp ON rp.role_id = ua.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ua.user_id = p_user_id
          AND ua.is_active = TRUE
          AND p.module = p_module
          AND p.action = p_action
    );
$$;

-- ============================================================
-- Check if user has a specific permission within a company scope
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_permission_in_company(
    p_user_id UUID,
    p_company_id UUID,
    p_module TEXT,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_assignments ua
        JOIN role_permissions rp ON rp.role_id = ua.role_id
        JOIN permissions p ON p.id = rp.permission_id
        JOIN companies c ON c.group_id = ua.group_id AND c.id = p_company_id
        WHERE ua.user_id = p_user_id
          AND ua.is_active = TRUE
          AND p.module = p_module
          AND p.action = p_action
          AND (ua.company_id IS NULL OR ua.company_id = p_company_id)
    );
$$;

-- ============================================================
-- Check if user has a specific permission within a branch scope
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_permission_in_branch(
    p_user_id UUID,
    p_branch_id UUID,
    p_module TEXT,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_assignments ua
        JOIN role_permissions rp ON rp.role_id = ua.role_id
        JOIN permissions p ON p.id = rp.permission_id
        JOIN branches b ON b.id = p_branch_id
        JOIN companies c ON c.id = b.company_id AND c.group_id = ua.group_id
        WHERE ua.user_id = p_user_id
          AND ua.is_active = TRUE
          AND p.module = p_module
          AND p.action = p_action
          AND (ua.company_id IS NULL OR ua.company_id = b.company_id)
          AND (ua.branch_id IS NULL OR ua.branch_id = p_branch_id)
    );
$$;

-- ============================================================
-- Get user's highest role hierarchy level (lower = more powerful)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_min_hierarchy_level(p_user_id UUID)
RETURNS SMALLINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        MIN(r.hierarchy_level),
        99  -- No role = no access
    )
    FROM user_assignments ua
    JOIN roles r ON r.id = ua.role_id
    WHERE ua.user_id = p_user_id
      AND ua.is_active = TRUE;
$$;

-- ============================================================
-- Check if user can access a specific employee's data
-- (employee's branch must be in user's accessible branches)
-- ============================================================
CREATE OR REPLACE FUNCTION user_can_access_employee(
    p_user_id UUID,
    p_employee_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.id = p_employee_id
          AND e.branch_id = ANY(get_user_accessible_branches(p_user_id))
    );
$$;
