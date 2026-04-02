-- Fix: use branches.code instead of UUID substring in receipt number generation
-- Bug: SUBSTRING(branch_id::TEXT, 1, 4) only takes first 4 hex chars of UUID.
--      Two branches in the same company with the same UUID prefix get identical
--      receipt numbers when their per-branch sequences coincide, violating
--      uq_txn_receipt_number (company_id, receipt_number).
-- Fix: look up branches.code (UNIQUE per company) and use that instead.

CREATE OR REPLACE FUNCTION generate_receipt_number_and_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prefix       TEXT;
    v_next_number  BIGINT;
    v_receipt      TEXT;
    v_day_date     DATE;
    v_branch_code  TEXT;
    v_salt         TEXT := 'prk_erp_2025_salt';
BEGIN
    -- Get the day date for the receipt
    SELECT date INTO v_day_date
    FROM cashbook_days
    WHERE id = NEW.cashbook_day_id;

    -- Get the branch code (unique per company, human-readable)
    SELECT code INTO v_branch_code
    FROM branches
    WHERE id = NEW.branch_id;

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
        v_branch_code,
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
