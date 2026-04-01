-- ============================================================
-- Migration 016: Feature Expansion
-- ============================================================
-- Adds:
--   1. New invoice types (bank_payment, other_income)
--   2. Telegram OTP system (otp_sessions + user telegram_chat_id)
--   3. Purchases module (suppliers, purchase_invoices, items)
--   4. Branch Transfers & Challans
--   5. Delivery Challan fields on invoices
--   6. Receipt approval status on cashbook_transactions
-- ============================================================

-- ============================================================
-- SECTION 1: EXTEND EXISTING ENUM TYPES
-- ============================================================

-- New invoice types for the dealership
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'bank_payment';
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'other_income';

-- Receipt can now be an approval entity
ALTER TYPE approval_entity_type ADD VALUE IF NOT EXISTS 'receipt';

-- ============================================================
-- SECTION 2: NEW ENUM TYPES
-- ============================================================

CREATE TYPE purchase_type AS ENUM (
    'vehicle', 'spare_parts', 'service_amc', 'general'
);

CREATE TYPE transfer_type AS ENUM (
    'vehicle', 'cash', 'documents', 'parts', 'other'
);

CREATE TYPE transfer_status AS ENUM (
    'draft', 'in_transit', 'received', 'cancelled'
);

CREATE TYPE challan_type AS ENUM (
    'delivery', 'branch_transfer', 'inter_company'
);

-- ============================================================
-- SECTION 3: USER PROFILES — TELEGRAM INTEGRATION
-- ============================================================

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- ============================================================
-- SECTION 4: OTP SESSIONS TABLE
-- ============================================================

CREATE TABLE otp_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT NOT NULL,          -- 'receipt' | 'day_close'
    entity_id       UUID NOT NULL,          -- cashbook_transaction_id / cashbook_day_id
    step            TEXT NOT NULL,          -- 'cashier' | 'executive' | 'manager'
    otp_hash        TEXT NOT NULL,          -- bcrypt hash of 6-digit OTP
    user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_entity ON otp_sessions(entity_id, step, used_at);
CREATE INDEX idx_otp_expires ON otp_sessions(expires_at) WHERE used_at IS NULL;

-- ============================================================
-- SECTION 5: INVOICE TABLE ADDITIONS
-- ============================================================

-- Bank Payment type fields
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS finance_company_name    TEXT,
    ADD COLUMN IF NOT EXISTS loan_account_ref        TEXT;

-- Other Income type fields
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS income_category         TEXT,
    ADD COLUMN IF NOT EXISTS income_ref_number       TEXT;

-- Delivery Challan fields
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS delivery_challan_number TEXT,
    ADD COLUMN IF NOT EXISTS delivery_challan_date   DATE,
    ADD COLUMN IF NOT EXISTS delivery_address        TEXT;

-- Invoice settlement flag (true when balance_due = 0)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- SECTION 6: CASHBOOK TRANSACTIONS — RECEIPT APPROVAL STATUS
-- ============================================================

-- Default 'approved' means old records and non-receipt transactions are unaffected
ALTER TABLE cashbook_transactions
    ADD COLUMN IF NOT EXISTS receipt_approval_status TEXT NOT NULL DEFAULT 'approved';
-- Values: 'pending_cashier' | 'pending_executive' | 'pending_manager' | 'approved'

COMMENT ON COLUMN cashbook_transactions.receipt_approval_status IS
    'OTP-based approval chain status: pending_cashier → pending_executive → pending_manager → approved';

-- ============================================================
-- SECTION 7: SUPPLIERS TABLE
-- ============================================================

CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    gstin       TEXT,
    pan         TEXT,
    phone       TEXT,
    email       TEXT,
    address     JSONB,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID REFERENCES user_profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_supplier_name UNIQUE (company_id, name)
);

CREATE INDEX idx_suppliers_company ON suppliers(company_id);
CREATE INDEX idx_suppliers_active  ON suppliers(company_id, is_active);

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SECTION 8: PURCHASE INVOICES
-- ============================================================

CREATE TABLE purchase_invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id               UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    financial_year_id       UUID REFERENCES financial_years(id),
    supplier_id             UUID REFERENCES suppliers(id),
    purchase_type           purchase_type NOT NULL,
    supplier_invoice_number TEXT,
    invoice_date            DATE NOT NULL,
    due_date                DATE,

    -- Financial
    base_amount             NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_breakup             JSONB NOT NULL DEFAULT '{"cgst": 0, "sgst": 0, "igst": 0, "cess": 0}',
    total_tax               NUMERIC(18,2) NOT NULL DEFAULT 0,
    grand_total             NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_paid              NUMERIC(18,2) NOT NULL DEFAULT 0,
    balance_due             NUMERIC(18,2) GENERATED ALWAYS AS (grand_total - total_paid) STORED,

    -- Meta
    notes                   TEXT,
    import_batch_id         UUID,           -- groups rows from same Excel import
    is_cancelled            BOOLEAN NOT NULL DEFAULT FALSE,
    created_by              UUID REFERENCES user_profiles(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                 INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_purchase_grand_total CHECK (grand_total >= 0),
    CONSTRAINT chk_purchase_total_paid  CHECK (total_paid >= 0)
);

CREATE INDEX idx_purchase_inv_company  ON purchase_invoices(company_id);
CREATE INDEX idx_purchase_inv_branch   ON purchase_invoices(branch_id);
CREATE INDEX idx_purchase_inv_supplier ON purchase_invoices(supplier_id);
CREATE INDEX idx_purchase_inv_date     ON purchase_invoices(invoice_date);
CREATE INDEX idx_purchase_inv_type     ON purchase_invoices(purchase_type);
CREATE INDEX idx_purchase_inv_batch    ON purchase_invoices(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX idx_purchase_inv_dues     ON purchase_invoices(company_id, balance_due) WHERE is_cancelled = FALSE;

CREATE TRIGGER trg_purchase_invoices_updated_at
    BEFORE UPDATE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_version_purchase_inv
    BEFORE UPDATE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION increment_version();

-- Prevent hard delete on purchase invoices
CREATE OR REPLACE FUNCTION prevent_purchase_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Hard delete not allowed on purchase_invoices. Use is_cancelled = TRUE instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_delete_purchase_invoices
    BEFORE DELETE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION prevent_purchase_delete();

-- ============================================================
-- SECTION 9: PURCHASE INVOICE ITEMS
-- ============================================================

CREATE TABLE purchase_invoice_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE RESTRICT,
    description         TEXT NOT NULL,
    hsn_sac             TEXT,
    quantity            NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit_price          NUMERIC(18,2) NOT NULL,
    tax_rate            NUMERIC(5,2) NOT NULL DEFAULT 0,
    amount              NUMERIC(18,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_purchase_item_qty    CHECK (quantity > 0),
    CONSTRAINT chk_purchase_item_price  CHECK (unit_price >= 0),
    CONSTRAINT chk_purchase_item_amount CHECK (amount >= 0)
);

CREATE INDEX idx_purchase_items_invoice ON purchase_invoice_items(purchase_invoice_id);

-- ============================================================
-- SECTION 10: BRANCH TRANSFERS
-- ============================================================

CREATE TABLE branch_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    from_branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    to_company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    to_branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    transfer_type   transfer_type NOT NULL,
    transfer_date   DATE NOT NULL,
    status          transfer_status NOT NULL DEFAULT 'draft',
    total_value     NUMERIC(18,2),
    notes           TEXT,

    -- Dispatch
    dispatched_by   UUID REFERENCES user_profiles(id),
    dispatched_at   TIMESTAMPTZ,

    -- Receipt
    received_by     UUID REFERENCES user_profiles(id),
    received_at     TIMESTAMPTZ,

    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_transfer_diff_branch CHECK (from_branch_id != to_branch_id)
);

CREATE INDEX idx_transfers_from_company ON branch_transfers(from_company_id);
CREATE INDEX idx_transfers_to_company   ON branch_transfers(to_company_id);
CREATE INDEX idx_transfers_from_branch  ON branch_transfers(from_branch_id);
CREATE INDEX idx_transfers_to_branch    ON branch_transfers(to_branch_id);
CREATE INDEX idx_transfers_group        ON branch_transfers(group_id);
CREATE INDEX idx_transfers_date         ON branch_transfers(transfer_date);
CREATE INDEX idx_transfers_status       ON branch_transfers(status);

CREATE TRIGGER trg_branch_transfers_updated_at
    BEFORE UPDATE ON branch_transfers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SECTION 11: TRANSFER ITEMS
-- ============================================================

CREATE TABLE transfer_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES branch_transfers(id) ON DELETE RESTRICT,
    item_type   TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity    NUMERIC(10,3),
    value       NUMERIC(18,2),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transfer_items_transfer ON transfer_items(transfer_id);

-- ============================================================
-- SECTION 12: TRANSFER CHALLANS
-- ============================================================

CREATE TABLE transfer_challans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id     UUID NOT NULL REFERENCES branch_transfers(id) ON DELETE RESTRICT,
    challan_number  TEXT NOT NULL,
    challan_date    DATE NOT NULL,
    challan_type    challan_type NOT NULL,
    generated_by    UUID REFERENCES user_profiles(id),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    signed_by       UUID REFERENCES user_profiles(id),
    received_by     UUID REFERENCES user_profiles(id),
    received_at     TIMESTAMPTZ,
    notes           TEXT,

    CONSTRAINT uq_challan_number UNIQUE (challan_number)
);

CREATE INDEX idx_challans_transfer ON transfer_challans(transfer_id);

-- ============================================================
-- SECTION 13: CHALLAN NUMBER SEQUENCE
-- (Reuses the same pattern as receipt_number_series)
-- ============================================================

CREATE TABLE challan_number_series (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    financial_year_id   UUID NOT NULL REFERENCES financial_years(id),
    prefix              TEXT NOT NULL DEFAULT 'TC',
    current_number      BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uq_challan_series UNIQUE (group_id, financial_year_id, prefix)
);

CREATE INDEX idx_challan_series_group ON challan_number_series(group_id);

-- Function to generate next challan number (race-condition safe)
CREATE OR REPLACE FUNCTION generate_challan_number(
    p_group_id          UUID,
    p_financial_year_id UUID,
    p_prefix            TEXT DEFAULT 'TC'
)
RETURNS TEXT AS $$
DECLARE
    v_next_num  BIGINT;
    v_fy_short  TEXT;
    v_series_id UUID;
BEGIN
    -- Get short FY label (e.g. '2526' for 2025-26)
    SELECT SUBSTRING(name FROM 3 FOR 2) || SUBSTRING(name FROM 8 FOR 2)
    INTO v_fy_short
    FROM financial_years
    WHERE id = p_financial_year_id;

    -- Advisory lock to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_group_id::text || p_financial_year_id::text || p_prefix));

    -- Upsert series row
    INSERT INTO challan_number_series (group_id, financial_year_id, prefix, current_number)
    VALUES (p_group_id, p_financial_year_id, p_prefix, 1)
    ON CONFLICT (group_id, financial_year_id, prefix)
    DO UPDATE SET current_number = challan_number_series.current_number + 1
    RETURNING id, current_number INTO v_series_id, v_next_num;

    RETURN p_prefix || '/' || v_fy_short || '/' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 14: ROW-LEVEL SECURITY POLICIES
-- ============================================================

-- OTP Sessions (user-scoped: only own session or service role)
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otp_sessions_select" ON otp_sessions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "otp_sessions_insert" ON otp_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "otp_sessions_update" ON otp_sessions
    FOR UPDATE USING (user_id = auth.uid());

-- Suppliers (company-scoped)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON suppliers
    FOR SELECT USING (company_id = ANY(get_user_accessible_companies(auth.uid())));

CREATE POLICY "suppliers_insert" ON suppliers
    FOR INSERT WITH CHECK (company_id = ANY(get_user_accessible_companies(auth.uid())));

CREATE POLICY "suppliers_update" ON suppliers
    FOR UPDATE USING (company_id = ANY(get_user_accessible_companies(auth.uid())));

-- Purchase Invoices (branch-scoped)
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_invoices_select" ON purchase_invoices
    FOR SELECT USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND (branch_id IS NULL OR branch_id = ANY(get_user_accessible_branches(auth.uid())))
    );

CREATE POLICY "purchase_invoices_insert" ON purchase_invoices
    FOR INSERT WITH CHECK (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "purchase_invoices_update" ON purchase_invoices
    FOR UPDATE USING (
        company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

-- Purchase Invoice Items (inherit from parent)
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_items_select" ON purchase_invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_invoices pi
            WHERE pi.id = purchase_invoice_id
              AND pi.company_id = ANY(get_user_accessible_companies(auth.uid()))
        )
    );

CREATE POLICY "purchase_items_insert" ON purchase_invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM purchase_invoices pi
            WHERE pi.id = purchase_invoice_id
              AND pi.company_id = ANY(get_user_accessible_companies(auth.uid()))
        )
    );

-- Branch Transfers (accessible to either from_company or to_company users)
ALTER TABLE branch_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select" ON branch_transfers
    FOR SELECT USING (
        from_company_id = ANY(get_user_accessible_companies(auth.uid()))
        OR to_company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

CREATE POLICY "transfers_insert" ON branch_transfers
    FOR INSERT WITH CHECK (
        from_company_id = ANY(get_user_accessible_companies(auth.uid()))
        AND from_branch_id = ANY(get_user_accessible_branches(auth.uid()))
    );

CREATE POLICY "transfers_update" ON branch_transfers
    FOR UPDATE USING (
        from_company_id = ANY(get_user_accessible_companies(auth.uid()))
        OR to_company_id = ANY(get_user_accessible_companies(auth.uid()))
    );

-- Transfer Items
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_items_select" ON transfer_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM branch_transfers bt
            WHERE bt.id = transfer_id
              AND (
                bt.from_company_id = ANY(get_user_accessible_companies(auth.uid()))
                OR bt.to_company_id = ANY(get_user_accessible_companies(auth.uid()))
              )
        )
    );

CREATE POLICY "transfer_items_insert" ON transfer_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM branch_transfers bt
            WHERE bt.id = transfer_id
              AND bt.from_company_id = ANY(get_user_accessible_companies(auth.uid()))
        )
    );

-- Transfer Challans
ALTER TABLE transfer_challans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_challans_select" ON transfer_challans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM branch_transfers bt
            WHERE bt.id = transfer_id
              AND (
                bt.from_company_id = ANY(get_user_accessible_companies(auth.uid()))
                OR bt.to_company_id = ANY(get_user_accessible_companies(auth.uid()))
              )
        )
    );

CREATE POLICY "transfer_challans_insert" ON transfer_challans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM branch_transfers bt
            WHERE bt.id = transfer_id
              AND bt.from_company_id = ANY(get_user_accessible_companies(auth.uid()))
        )
    );

-- Challan Number Series (group-scoped, read-only for users)
ALTER TABLE challan_number_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challan_series_select" ON challan_number_series
    FOR SELECT USING (
        group_id = ANY(get_user_group_ids(auth.uid()))
    );

-- ============================================================
-- SECTION 15: TRIGGER — AUTO-SETTLE INVOICE WHEN BALANCE = 0
-- ============================================================

CREATE OR REPLACE FUNCTION auto_settle_invoice()
RETURNS TRIGGER AS $$
BEGIN
    -- After a payment is inserted, check if invoice is fully paid
    UPDATE invoices
    SET is_settled = (grand_total <= total_received),
        updated_at = now()
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_settle_invoice
    AFTER INSERT ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION auto_settle_invoice();

-- ============================================================
-- SECTION 16: COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE otp_sessions IS 'Temporary OTP records for Telegram-based approval flows. TTL enforced by expires_at.';
COMMENT ON TABLE suppliers IS 'Vendor/supplier master for purchase invoices.';
COMMENT ON TABLE purchase_invoices IS 'Records purchases from vendors — vehicles, spare parts, services, general goods.';
COMMENT ON TABLE purchase_invoice_items IS 'Line items for each purchase invoice.';
COMMENT ON TABLE branch_transfers IS 'Inter-branch and inter-company transfer records.';
COMMENT ON TABLE transfer_items IS 'Individual items within a branch transfer.';
COMMENT ON TABLE transfer_challans IS 'Challan documents generated for branch transfers.';
COMMENT ON TABLE challan_number_series IS 'Sequential number generator for transfer challans (race-condition safe).';
