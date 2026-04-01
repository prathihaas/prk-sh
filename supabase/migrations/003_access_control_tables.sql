-- ============================================================
-- Migration 003: User Profiles, Roles, Permissions, Assignments
-- ============================================================

-- ========================
-- USER PROFILES
-- ========================
CREATE TABLE user_profiles (
    id          UUID PRIMARY KEY,       -- matches auth.users.id
    email       TEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    phone       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Now add deferred FK for branches.manager_user_id
ALTER TABLE branches
    ADD CONSTRAINT fk_branches_manager
    FOREIGN KEY (manager_user_id)
    REFERENCES user_profiles(id)
    ON DELETE SET NULL;

-- Add deferred FK for financial_years.locked_by
ALTER TABLE financial_years
    ADD CONSTRAINT fk_fy_locked_by
    FOREIGN KEY (locked_by)
    REFERENCES user_profiles(id)
    ON DELETE SET NULL;

-- ========================
-- ROLES
-- ========================
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    hierarchy_level SMALLINT NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- PERMISSIONS
-- ========================
CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module      TEXT NOT NULL,
    action      TEXT NOT NULL,
    description TEXT,

    CONSTRAINT uq_permissions_module_action UNIQUE (module, action)
);

-- ========================
-- ROLE ↔ PERMISSION MAPPING
-- ========================
CREATE TABLE role_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_perm ON role_permissions(permission_id);

-- ========================
-- USER ASSIGNMENTS (Role + Scope)
-- ========================
-- This is the critical table: it binds a user to a role
-- within a specific scope (group → company → branch).
--
-- Scope rules:
--   company_id IS NULL → access to ALL companies in group
--   branch_id  IS NULL → access to ALL branches in company
--   Both populated   → scoped to one specific branch
-- ========================
CREATE TABLE user_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    company_id  UUID REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id   UUID REFERENCES branches(id) ON DELETE RESTRICT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,

    -- A user cannot hold the same role+scope combination twice while active
    CONSTRAINT uq_user_assignments_active
        UNIQUE NULLS NOT DISTINCT (user_id, role_id, group_id, company_id, branch_id)
);

CREATE INDEX idx_user_assignments_user ON user_assignments(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_assignments_company ON user_assignments(company_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_assignments_branch ON user_assignments(branch_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_assignments_group ON user_assignments(group_id) WHERE is_active = TRUE;

-- Constraint: branch must belong to company, company must belong to group
-- Enforced via trigger (cross-FK validation)
CREATE OR REPLACE FUNCTION validate_user_assignment_scope()
RETURNS TRIGGER AS $$
BEGIN
    -- If company_id is set, verify it belongs to the group
    IF NEW.company_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM companies
            WHERE id = NEW.company_id AND group_id = NEW.group_id
        ) THEN
            RAISE EXCEPTION 'Company % does not belong to group %',
                NEW.company_id, NEW.group_id;
        END IF;
    END IF;

    -- If branch_id is set, verify it belongs to the company
    IF NEW.branch_id IS NOT NULL THEN
        IF NEW.company_id IS NULL THEN
            RAISE EXCEPTION 'branch_id cannot be set without company_id';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM branches
            WHERE id = NEW.branch_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'Branch % does not belong to company %',
                NEW.branch_id, NEW.company_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_user_assignment
    BEFORE INSERT OR UPDATE ON user_assignments
    FOR EACH ROW EXECUTE FUNCTION validate_user_assignment_scope();
