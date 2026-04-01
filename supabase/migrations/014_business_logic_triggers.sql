-- ============================================================
-- Migration 014: Business Logic Triggers
-- Immutability enforcement, locking, receipt hash, version mgmt
-- ============================================================

-- ============================================================
-- 1. PREVENT HARD DELETE ON ALL FINANCIAL TABLES
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Hard delete is not allowed on table %. Use soft delete (void/cancel) instead.', TG_TABLE_NAME;
    RETURN NULL;
END;
$$;

-- Attach to all financial tables
CREATE TRIGGER trg_no_delete_cashbook_transactions
    BEFORE DELETE ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_cashbook_days
    BEFORE DELETE ON cashbook_days
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_invoices
    BEFORE DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_invoice_payments
    BEFORE DELETE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_expenses
    BEFORE DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_payroll_runs
    BEFORE DELETE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_payroll_entries
    BEFORE DELETE ON payroll_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_attendance_records
    BEFORE DELETE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_transaction_revisions
    BEFORE DELETE ON transaction_revisions
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_no_delete_fraud_flags
    BEFORE DELETE ON fraud_flags
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

-- ============================================================
-- 2. BLOCK TRANSACTIONS ON CLOSED CASHBOOK DAYS
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_cashbook_day_open()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_day_status cashbook_day_status;
BEGIN
    SELECT status INTO v_day_status
    FROM cashbook_days
    WHERE id = NEW.cashbook_day_id;

    IF v_day_status NOT IN ('open', 'reopened') THEN
        RAISE EXCEPTION 'Cannot create/modify transaction: cashbook day (%) is %. Day must be open.',
            NEW.cashbook_day_id, v_day_status;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_day_open_insert
    BEFORE INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION enforce_cashbook_day_open();

CREATE TRIGGER trg_enforce_day_open_update
    BEFORE UPDATE ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION enforce_cashbook_day_open();

-- ============================================================
-- 3. BLOCK OPERATIONS ON LOCKED FINANCIAL YEAR
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_financial_year_unlocked()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    IF NEW.financial_year_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT is_locked INTO v_is_locked
    FROM financial_years
    WHERE id = NEW.financial_year_id;

    IF v_is_locked = TRUE THEN
        RAISE EXCEPTION 'Cannot modify records: financial year (%) is locked.',
            NEW.financial_year_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach to all tables that reference financial_year_id
CREATE TRIGGER trg_fy_lock_cashbook_txn
    BEFORE INSERT OR UPDATE ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION enforce_financial_year_unlocked();

CREATE TRIGGER trg_fy_lock_invoices
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION enforce_financial_year_unlocked();

CREATE TRIGGER trg_fy_lock_expenses
    BEFORE INSERT OR UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION enforce_financial_year_unlocked();

-- ============================================================
-- 4. DAY CLOSE VALIDATION
-- Ensures physical_count is provided before closing
-- ============================================================
CREATE OR REPLACE FUNCTION validate_day_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only validate when transitioning TO 'closed' status
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        -- Physical count must be entered
        IF NEW.physical_count IS NULL THEN
            RAISE EXCEPTION 'Cannot close day: physical cash count is required.';
        END IF;

        -- Calculate system closing balance from transactions
        NEW.system_closing := NEW.opening_balance + COALESCE((
            SELECT
                SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE 0 END) -
                SUM(CASE WHEN txn_type = 'payment' THEN amount ELSE 0 END)
            FROM cashbook_transactions
            WHERE cashbook_day_id = NEW.id
              AND is_voided = FALSE
        ), 0);

        -- Set closure metadata
        NEW.closed_at := now();

        -- If there's a significant variance, require approval
        IF ABS(NEW.physical_count - NEW.system_closing) > 0 AND
           NEW.variance_approved = FALSE THEN
            -- Don't block, but mark as needing approval
            -- The fraud detection trigger will also flag this
            NULL;
        END IF;
    END IF;

    -- Validate reopen requires reason
    IF NEW.status = 'reopened' AND OLD.status = 'closed' THEN
        IF NEW.reopen_reason IS NULL OR NEW.reopen_reason = '' THEN
            RAISE EXCEPTION 'Cannot reopen day: reason is required.';
        END IF;
        IF NEW.reopen_approved_by IS NULL THEN
            RAISE EXCEPTION 'Cannot reopen day: higher-level approval is required.';
        END IF;
        NEW.reopened_at := now();
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_day_close
    BEFORE UPDATE ON cashbook_days
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_day_close();

-- ============================================================
-- 5. RECEIPT NUMBER GENERATION & HASH
-- Auto-generates receipt number and computes verification hash
-- ============================================================
CREATE OR REPLACE FUNCTION generate_receipt_number_and_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prefix TEXT;
    v_next_number BIGINT;
    v_receipt TEXT;
    v_day_date DATE;
    v_salt TEXT := 'prk_erp_2025_salt';  -- Application-level salt
BEGIN
    -- Get the day date for the receipt
    SELECT date INTO v_day_date
    FROM cashbook_days
    WHERE id = NEW.cashbook_day_id;

    -- Get or create the receipt series for this branch
    -- Use advisory lock to prevent race conditions
    PERFORM pg_advisory_xact_lock(
        hashtext(NEW.branch_id::TEXT || COALESCE(NEW.financial_year_id::TEXT, 'default'))
    );

    -- Upsert the series and get next number
    INSERT INTO receipt_number_series (
        branch_id, company_id, financial_year_id, prefix, current_number
    ) VALUES (
        NEW.branch_id,
        NEW.company_id,
        NEW.financial_year_id,
        'RCP',
        1
    )
    ON CONFLICT (branch_id, financial_year_id, prefix)
    DO UPDATE SET current_number = receipt_number_series.current_number + 1
    RETURNING prefix, current_number INTO v_prefix, v_next_number;

    -- Generate receipt number: PREFIX-BRANCHCODE-YYMM-SEQUENCE
    -- e.g., RCP-BR01-2501-00042
    v_receipt := format('%s-%s-%s-%s',
        v_prefix,
        SUBSTRING(NEW.branch_id::TEXT, 1, 4),
        to_char(v_day_date, 'YYMM'),
        lpad(v_next_number::TEXT, 5, '0')
    );

    NEW.receipt_number := v_receipt;

    -- Generate SHA-256 hash for QR verification
    NEW.receipt_hash := encode(
        digest(
            v_receipt || '|' ||
            NEW.amount::TEXT || '|' ||
            v_day_date::TEXT || '|' ||
            NEW.cashbook_id::TEXT || '|' ||
            NEW.company_id::TEXT || '|' ||
            v_salt,
            'sha256'
        ),
        'hex'
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_receipt
    BEFORE INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION generate_receipt_number_and_hash();

-- ============================================================
-- 6. VERSION INCREMENT ON UPDATE
-- Optimistic concurrency control for financial records
-- ============================================================
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_version_cashbook_txn
    BEFORE UPDATE ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER trg_version_invoices
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER trg_version_expenses
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION increment_version();

-- ============================================================
-- 7. PAYMENT MODE CHANGE PROTECTION
-- Prevents direct update of payment_mode without revision record
-- ============================================================
CREATE OR REPLACE FUNCTION protect_payment_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.payment_mode IS DISTINCT FROM NEW.payment_mode THEN
        -- Check if a corresponding revision record was created
        -- (the application must create the revision BEFORE updating)
        IF NOT EXISTS (
            SELECT 1 FROM transaction_revisions
            WHERE transaction_id = NEW.id
              AND field_changed = 'payment_mode'
              AND approval_status = 'approved'
              AND changed_at > (now() - INTERVAL '5 minutes')
        ) THEN
            RAISE EXCEPTION
                'Payment mode cannot be changed without an approved revision request. '
                'Create a transaction_revision with field_changed=payment_mode and get it approved first.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_payment_mode
    BEFORE UPDATE ON cashbook_transactions
    FOR EACH ROW
    WHEN (OLD.payment_mode IS DISTINCT FROM NEW.payment_mode)
    EXECUTE FUNCTION protect_payment_mode();

-- ============================================================
-- 8. INVOICE DELIVERY GATE
-- Delivery is only allowed after both approvals
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_invoice_delivery_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_delivery_allowed = TRUE AND OLD.is_delivery_allowed = FALSE THEN
        -- Must have accounts approval
        IF NEW.accounts_approved_by IS NULL THEN
            RAISE EXCEPTION 'Invoice delivery requires accounts approval first.';
        END IF;

        -- Must have manager approval
        IF NEW.manager_approved_by IS NULL THEN
            RAISE EXCEPTION 'Invoice delivery requires manager approval first.';
        END IF;

        -- Invoice must not be cancelled
        IF NEW.is_cancelled = TRUE THEN
            RAISE EXCEPTION 'Cannot allow delivery for a cancelled invoice.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_delivery_gate
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    WHEN (NEW.is_delivery_allowed = TRUE AND OLD.is_delivery_allowed = FALSE)
    EXECUTE FUNCTION enforce_invoice_delivery_gate();

-- ============================================================
-- 9. EXPENSE APPROVAL CHAIN ENFORCEMENT
-- Cannot skip approval levels
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_expense_approval_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Cannot go to accounts_approved without branch_approved
    IF NEW.approval_status = 'accounts_approved' AND
       OLD.approval_status NOT IN ('branch_approved') THEN
        RAISE EXCEPTION 'Expense must be branch_approved before accounts approval.';
    END IF;

    -- Cannot go to owner_approved without accounts_approved
    IF NEW.approval_status = 'owner_approved' AND
       OLD.approval_status NOT IN ('accounts_approved') THEN
        RAISE EXCEPTION 'Expense must be accounts_approved before owner approval.';
    END IF;

    -- Set timestamps
    CASE NEW.approval_status
        WHEN 'branch_approved' THEN
            NEW.branch_approved_at := now();
        WHEN 'accounts_approved' THEN
            NEW.accounts_approved_at := now();
        WHEN 'owner_approved' THEN
            NEW.owner_approved_at := now();
        ELSE
            NULL;
    END CASE;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expense_approval_chain
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
    EXECUTE FUNCTION enforce_expense_approval_chain();

-- ============================================================
-- 10. SYSTEM CLOSING BALANCE AUTO-CALCULATION
-- Updates system_closing on cashbook_day when transactions change
-- ============================================================
CREATE OR REPLACE FUNCTION update_system_closing_balance()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_day_id UUID;
    v_opening NUMERIC(18,2);
    v_net NUMERIC(18,2);
BEGIN
    -- Determine which cashbook_day to update
    IF TG_OP = 'DELETE' THEN
        v_day_id := OLD.cashbook_day_id;
    ELSE
        v_day_id := NEW.cashbook_day_id;
    END IF;

    -- Get opening balance
    SELECT opening_balance INTO v_opening
    FROM cashbook_days WHERE id = v_day_id;

    -- Calculate net from non-voided transactions
    SELECT COALESCE(
        SUM(CASE WHEN txn_type = 'receipt' THEN amount ELSE -amount END),
        0
    ) INTO v_net
    FROM cashbook_transactions
    WHERE cashbook_day_id = v_day_id
      AND is_voided = FALSE;

    -- Update system closing
    UPDATE cashbook_days
    SET system_closing = v_opening + v_net
    WHERE id = v_day_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_closing_on_insert
    AFTER INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION update_system_closing_balance();

CREATE TRIGGER trg_update_closing_on_update
    AFTER UPDATE ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION update_system_closing_balance();

-- ============================================================
-- 11. RECEIPT NUMBER VERIFICATION FUNCTION (RPC)
-- Called to verify a receipt QR code
-- ============================================================
CREATE OR REPLACE FUNCTION verify_receipt(
    p_receipt_number TEXT,
    p_receipt_hash TEXT
)
RETURNS TABLE (
    is_valid BOOLEAN,
    transaction_id UUID,
    amount NUMERIC(18,2),
    payment_mode payment_mode,
    txn_type txn_type,
    is_voided BOOLEAN,
    created_at TIMESTAMPTZ,
    cashbook_name TEXT,
    branch_name TEXT,
    company_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        (ct.receipt_hash = p_receipt_hash) AS is_valid,
        ct.id AS transaction_id,
        ct.amount,
        ct.payment_mode,
        ct.txn_type,
        ct.is_voided,
        ct.created_at,
        cb.name AS cashbook_name,
        b.name AS branch_name,
        c.name AS company_name
    FROM cashbook_transactions ct
    JOIN cashbooks cb ON cb.id = ct.cashbook_id
    JOIN branches b ON b.id = ct.branch_id
    JOIN companies c ON c.id = ct.company_id
    WHERE ct.receipt_number = p_receipt_number;
$$;

-- ============================================================
-- 12. PAYROLL RUN TOTALS AUTO-UPDATE
-- After payroll entries are inserted/updated, update run totals
-- ============================================================
CREATE OR REPLACE FUNCTION update_payroll_run_totals()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_run_id UUID;
BEGIN
    v_run_id := COALESCE(NEW.payroll_run_id, OLD.payroll_run_id);

    UPDATE payroll_runs
    SET
        total_gross = sub.total_gross,
        total_deductions = sub.total_deductions,
        total_net = sub.total_net
    FROM (
        SELECT
            SUM(gross_salary) AS total_gross,
            SUM(total_deductions) AS total_deductions,
            SUM(net_salary) AS total_net
        FROM payroll_entries
        WHERE payroll_run_id = v_run_id
    ) sub
    WHERE id = v_run_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_payroll_totals
    AFTER INSERT OR UPDATE ON payroll_entries
    FOR EACH ROW EXECUTE FUNCTION update_payroll_run_totals();
