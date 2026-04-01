-- ============================================================
-- Migration 002: Organizational Hierarchy Tables
-- ============================================================

-- ========================
-- GROUPS (Tenant Root)
-- ========================
CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- COMPANIES
-- ========================
CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    legal_name  TEXT,
    gstin       TEXT,
    pan         TEXT,
    address     JSONB DEFAULT '{}',
    logo_url    TEXT,
    config      JSONB DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_companies_group_code UNIQUE (group_id, code)
);

CREATE INDEX idx_companies_group_id ON companies(group_id);

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- BRANCHES
-- ========================
CREATE TABLE branches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    code            TEXT NOT NULL,
    address         JSONB DEFAULT '{}',
    manager_user_id UUID,  -- FK added after user_profiles table
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_branches_company_code UNIQUE (company_id, code)
);

CREATE INDEX idx_branches_company_id ON branches(company_id);

CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- FINANCIAL YEARS
-- ========================
CREATE TABLE financial_years (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    label       TEXT NOT NULL,           -- e.g. "2025-26"
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
    locked_by   UUID,                    -- FK added after user_profiles
    locked_at   TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_fy_company_label UNIQUE (company_id, label),
    CONSTRAINT chk_fy_dates CHECK (start_date < end_date)
);

CREATE INDEX idx_fy_company_id ON financial_years(company_id);
