-- ============================================================
-- Migration 004: Cash Management Tables
-- ============================================================

-- ========================
-- CASHBOOKS
-- ========================
CREATE TABLE cashbooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    type            cashbook_type NOT NULL,
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_cashbooks_branch_name UNIQUE (branch_id, name)
);

CREATE INDEX idx_cashbooks_company ON cashbooks(company_id);
CREATE INDEX idx_cashbooks_branch ON cashbooks(branch_id);

CREATE TRIGGER trg_cashbooks_updated_at
    BEFORE UPDATE ON cashbooks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Validate branch belongs to company
CREATE OR REPLACE FUNCTION validate_cashbook_branch()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM branches
        WHERE id = NEW.branch_id AND company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'Branch % does not belong to company %',
            NEW.branch_id, NEW.company_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_cashbook_branch
    BEFORE INSERT OR UPDATE ON cashbooks
    FOR EACH ROW EXECUTE FUNCTION validate_cashbook_branch();

-- ========================
-- CASHBOOK DAYS
-- ========================
CREATE TABLE cashbook_days (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashbook_id         UUID NOT NULL REFERENCES cashbooks(id) ON DELETE RESTRICT,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    date                DATE NOT NULL,
    opening_balance     NUMERIC(18,2) NOT NULL,
    system_closing      NUMERIC(18,2),
    physical_count      NUMERIC(18,2),
    variance            NUMERIC(18,2) GENERATED ALWAYS AS (
                            physical_count - system_closing
                        ) STORED,
    variance_approved       BOOLEAN NOT NULL DEFAULT FALSE,
    variance_approved_by    UUID REFERENCES user_profiles(id),
    variance_approved_at    TIMESTAMPTZ,
    variance_reason         TEXT,
    status              cashbook_day_status NOT NULL DEFAULT 'open',
    closed_by           UUID REFERENCES user_profiles(id),
    closed_at           TIMESTAMPTZ,
    reopened_by         UUID REFERENCES user_profiles(id),
    reopened_at         TIMESTAMPTZ,
    reopen_reason       TEXT,
    reopen_approved_by  UUID REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_cashbook_day UNIQUE (cashbook_id, date)
);

CREATE INDEX idx_cashbook_days_cashbook ON cashbook_days(cashbook_id);
CREATE INDEX idx_cashbook_days_company ON cashbook_days(company_id);
CREATE INDEX idx_cashbook_days_date ON cashbook_days(date);
CREATE INDEX idx_cashbook_days_status ON cashbook_days(status);

-- ========================
-- RECEIPT NUMBER SERIES
-- ========================
CREATE TABLE receipt_number_series (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    financial_year_id   UUID REFERENCES financial_years(id),
    prefix              TEXT NOT NULL,
    current_number      BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uq_receipt_series UNIQUE (branch_id, financial_year_id, prefix)
);

-- ========================
-- CASHBOOK TRANSACTIONS
-- ========================
CREATE TABLE cashbook_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashbook_id         UUID NOT NULL REFERENCES cashbooks(id) ON DELETE RESTRICT,
    cashbook_day_id     UUID NOT NULL REFERENCES cashbook_days(id) ON DELETE RESTRICT,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    financial_year_id   UUID REFERENCES financial_years(id),
    txn_type            txn_type NOT NULL,
    amount              NUMERIC(18,2) NOT NULL,
    payment_mode        payment_mode NOT NULL,
    narration           TEXT NOT NULL,
    reference_type      TEXT,
    reference_id        UUID,
    receipt_number      TEXT NOT NULL,
    receipt_hash        TEXT NOT NULL,
    contra_cashbook_id  UUID REFERENCES cashbooks(id),
    is_voided           BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason         TEXT,
    voided_by           UUID REFERENCES user_profiles(id),
    voided_at           TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_txn_amount_positive CHECK (amount > 0),
    CONSTRAINT uq_txn_receipt_number UNIQUE (company_id, receipt_number)
);

CREATE INDEX idx_txn_cashbook ON cashbook_transactions(cashbook_id);
CREATE INDEX idx_txn_cashbook_day ON cashbook_transactions(cashbook_day_id);
CREATE INDEX idx_txn_company ON cashbook_transactions(company_id);
CREATE INDEX idx_txn_branch ON cashbook_transactions(branch_id);
CREATE INDEX idx_txn_date ON cashbook_transactions(created_at);
CREATE INDEX idx_txn_receipt_hash ON cashbook_transactions(receipt_hash);
CREATE INDEX idx_txn_reference ON cashbook_transactions(reference_type, reference_id);
CREATE INDEX idx_txn_voided ON cashbook_transactions(is_voided) WHERE is_voided = TRUE;

-- ========================
-- TRANSACTION REVISIONS (Immutable change log)
-- ========================
CREATE TABLE transaction_revisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID NOT NULL REFERENCES cashbook_transactions(id) ON DELETE RESTRICT,
    revision_number     INTEGER NOT NULL,
    field_changed       TEXT NOT NULL,
    old_value           TEXT,
    new_value           TEXT,
    change_reason       TEXT NOT NULL,
    changed_by          UUID NOT NULL REFERENCES user_profiles(id),
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address          INET,
    user_agent          TEXT,
    approval_status     revision_approval_status NOT NULL DEFAULT 'pending',
    approved_by         UUID REFERENCES user_profiles(id),
    approved_at         TIMESTAMPTZ
);

CREATE INDEX idx_revisions_txn ON transaction_revisions(transaction_id);
CREATE INDEX idx_revisions_changed_by ON transaction_revisions(changed_by);
CREATE INDEX idx_revisions_status ON transaction_revisions(approval_status);
