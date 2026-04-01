-- ============================================================
-- Migration 005: Invoice Recording & Expense Module
-- ============================================================

-- ========================
-- INVOICES
-- ========================
CREATE TABLE invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id               UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    financial_year_id       UUID REFERENCES financial_years(id),
    invoice_type            invoice_type NOT NULL,
    dms_invoice_number      TEXT NOT NULL,
    invoice_date            DATE NOT NULL,
    customer_name           TEXT NOT NULL,
    customer_phone          TEXT,
    customer_gstin          TEXT,

    -- Automobile Sale Fields
    vehicle_sale_value      NUMERIC(18,2) DEFAULT 0,
    insurance_amount        NUMERIC(18,2) DEFAULT 0,
    accessories_amount      NUMERIC(18,2) DEFAULT 0,
    tr_charges              NUMERIC(18,2) DEFAULT 0,
    registration_charges    NUMERIC(18,2) DEFAULT 0,
    other_charges           NUMERIC(18,2) DEFAULT 0,

    -- Tractor / Agri Sale Fields
    machine_value           NUMERIC(18,2) DEFAULT 0,
    implements_amount       NUMERIC(18,2) DEFAULT 0,
    finance_subsidy         NUMERIC(18,2) DEFAULT 0,

    -- Service Invoice Fields
    parts_amount            NUMERIC(18,2) DEFAULT 0,
    labour_amount           NUMERIC(18,2) DEFAULT 0,
    discount_amount         NUMERIC(18,2) DEFAULT 0,

    -- Tax Breakup
    tax_breakup             JSONB NOT NULL DEFAULT '{
        "cgst": 0, "sgst": 0, "igst": 0, "cess": 0, "tcs": 0
    }',
    total_tax               NUMERIC(18,2) NOT NULL DEFAULT 0,
    grand_total             NUMERIC(18,2) NOT NULL,
    total_received          NUMERIC(18,2) NOT NULL DEFAULT 0,
    balance_due             NUMERIC(18,2) GENERATED ALWAYS AS (
                                grand_total - total_received
                            ) STORED,

    -- Approval & Delivery
    approval_status         invoice_approval_status NOT NULL DEFAULT 'pending',
    accounts_approved_by    UUID REFERENCES user_profiles(id),
    accounts_approved_at    TIMESTAMPTZ,
    manager_approved_by     UUID REFERENCES user_profiles(id),
    manager_approved_at     TIMESTAMPTZ,
    is_delivery_allowed     BOOLEAN NOT NULL DEFAULT FALSE,
    delivered_at            TIMESTAMPTZ,

    -- Meta
    notes                   TEXT,
    is_cancelled            BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_by            UUID REFERENCES user_profiles(id),
    cancelled_at            TIMESTAMPTZ,
    cancel_reason           TEXT,
    created_by              UUID NOT NULL REFERENCES user_profiles(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                 INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT uq_invoice_dms UNIQUE (company_id, dms_invoice_number),
    CONSTRAINT chk_invoice_grand_total CHECK (grand_total >= 0)
);

CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_branch ON invoices(branch_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_approval ON invoices(approval_status);
CREATE INDEX idx_invoices_fy ON invoices(financial_year_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_name);

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- INVOICE PAYMENTS (links invoice → cashbook transaction)
-- ========================
CREATE TABLE invoice_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    transaction_id      UUID REFERENCES cashbook_transactions(id),
    payment_mode        payment_mode NOT NULL,
    amount              NUMERIC(18,2) NOT NULL,
    reference_number    TEXT,
    payment_date        DATE NOT NULL,
    notes               TEXT,
    created_by          UUID NOT NULL REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_inv_payment_amount CHECK (amount > 0)
);

CREATE INDEX idx_inv_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_inv_payments_txn ON invoice_payments(transaction_id);
CREATE INDEX idx_inv_payments_company ON invoice_payments(company_id);

-- Trigger: update total_received on invoices when payment is added
CREATE OR REPLACE FUNCTION update_invoice_total_received()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE invoices
    SET total_received = (
        SELECT COALESCE(SUM(amount), 0)
        FROM invoice_payments
        WHERE invoice_id = NEW.invoice_id
    ),
    updated_at = now()
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_received
    AFTER INSERT ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_total_received();

-- ========================
-- EXPENSE CATEGORIES
-- ========================
CREATE TABLE expense_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    budget_limit NUMERIC(18,2),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_expense_cat UNIQUE (company_id, name)
);

CREATE INDEX idx_expense_cat_company ON expense_categories(company_id);

-- ========================
-- EXPENSES
-- ========================
CREATE TABLE expenses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id               UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    financial_year_id       UUID REFERENCES financial_years(id),
    category_id             UUID REFERENCES expense_categories(id),
    expense_date            DATE NOT NULL,
    amount                  NUMERIC(18,2) NOT NULL,
    description             TEXT NOT NULL,
    bill_url                TEXT,
    bill_file_path          TEXT,
    ledger_ref_id           TEXT,

    -- Submitter
    submitted_by            UUID NOT NULL REFERENCES user_profiles(id),
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Approval chain
    approval_status         expense_approval_status NOT NULL DEFAULT 'submitted',
    branch_approved_by      UUID REFERENCES user_profiles(id),
    branch_approved_at      TIMESTAMPTZ,
    accounts_approved_by    UUID REFERENCES user_profiles(id),
    accounts_approved_at    TIMESTAMPTZ,
    owner_approved_by       UUID REFERENCES user_profiles(id),
    owner_approved_at       TIMESTAMPTZ,
    rejection_reason        TEXT,

    -- Posting to cashbook
    is_posted               BOOLEAN NOT NULL DEFAULT FALSE,
    posted_txn_id           UUID REFERENCES cashbook_transactions(id),
    posted_at               TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                 INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_expense_amount CHECK (amount > 0)
);

CREATE INDEX idx_expenses_company ON expenses(company_id);
CREATE INDEX idx_expenses_branch ON expenses(branch_id);
CREATE INDEX idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX idx_expenses_approval ON expenses(approval_status);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category_id);

CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
