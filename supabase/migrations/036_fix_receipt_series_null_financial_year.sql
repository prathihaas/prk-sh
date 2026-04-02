-- Fix: receipt series unique constraint does not deduplicate NULL financial_year_id rows
--
-- Root cause: PostgreSQL's default UNIQUE treats NULL != NULL, so
-- ON CONFLICT (branch_id, financial_year_id, prefix) never matches when
-- financial_year_id IS NULL. Every back-dated receipt (NULL FY) inserted a
-- NEW row with current_number = 1, giving every such receipt sequence 00001
-- and causing uq_txn_receipt_number violations.
--
-- Fix:
--   1. Consolidate duplicate NULL-FY rows: keep max(current_number) per branch+prefix
--   2. Replace the unique constraint with NULLS NOT DISTINCT so NULL=NULL for
--      uniqueness/conflict purposes (requires PostgreSQL 15+)
--   3. Update the trigger ON CONFLICT clause to match

-- Step 1: Consolidate duplicate NULL-FY series rows, keeping the highest sequence
-- For each branch+prefix with multiple NULL-FY rows, update one to max and delete rest
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT branch_id, prefix, MAX(current_number) AS max_num
        FROM receipt_number_series
        WHERE financial_year_id IS NULL
        GROUP BY branch_id, prefix
        HAVING COUNT(*) > 1
    LOOP
        -- Delete all NULL-FY rows for this branch+prefix
        DELETE FROM receipt_number_series
        WHERE branch_id = r.branch_id
          AND prefix = r.prefix
          AND financial_year_id IS NULL;

        -- Re-insert a single row with the max sequence
        INSERT INTO receipt_number_series (branch_id, company_id, financial_year_id, prefix, current_number)
        SELECT b.id, b.company_id, NULL, r.prefix, r.max_num
        FROM branches b
        WHERE b.id = r.branch_id;
    END LOOP;
END;
$$;

-- Step 2: Drop the old unique constraint
ALTER TABLE receipt_number_series
    DROP CONSTRAINT uq_receipt_series;

-- Step 3: Re-create with NULLS NOT DISTINCT so NULL financial_year_id rows
-- are treated as equal (only one NULL-FY row allowed per branch+prefix)
ALTER TABLE receipt_number_series
    ADD CONSTRAINT uq_receipt_series
    UNIQUE NULLS NOT DISTINCT (branch_id, financial_year_id, prefix);

-- Step 4: Update the trigger function to use NULLS NOT DISTINCT in ON CONFLICT
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

    -- Use advisory lock to prevent race conditions per branch+FY
    PERFORM pg_advisory_xact_lock(
        hashtext(NEW.branch_id::TEXT || COALESCE(NEW.financial_year_id::TEXT, 'null_fy'))
    );

    -- Upsert the series and get next number.
    -- NULLS NOT DISTINCT ensures NULL financial_year_id rows match on conflict.
    INSERT INTO receipt_number_series (
        branch_id, company_id, financial_year_id, prefix, current_number
    ) VALUES (
        NEW.branch_id,
        NEW.company_id,
        NEW.financial_year_id,
        'RCP',
        1
    )
    ON CONFLICT ON CONSTRAINT uq_receipt_series
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
