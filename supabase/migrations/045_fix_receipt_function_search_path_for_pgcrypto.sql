-- 045: Re-pin search_path on generate_receipt_number_and_hash to include
-- the extensions schema so digest() (pgcrypto) resolves.
--
-- Migration 044 made the function SECURITY DEFINER and locked
-- search_path = public, pg_temp. In Supabase, pgcrypto lives in the
-- 'extensions' schema, so digest() was no longer visible and every
-- transaction insert blew up with:
--   "function digest(text, unknown) does not exist"
--
-- Adding 'extensions' to the pinned search_path resolves digest() while
-- keeping the function safely scoped (no user-controlled schemas).

CREATE OR REPLACE FUNCTION public.generate_receipt_number_and_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_prefix       TEXT;
    v_next_number  BIGINT;
    v_receipt      TEXT;
    v_day_date     DATE;
    v_branch_code  TEXT;
    v_salt         TEXT := 'prk_erp_2025_salt';
BEGIN
    SELECT date INTO v_day_date
    FROM cashbook_days
    WHERE id = NEW.cashbook_day_id;

    SELECT code INTO v_branch_code
    FROM branches
    WHERE id = NEW.branch_id;

    PERFORM pg_advisory_xact_lock(
        hashtext(NEW.branch_id::TEXT || COALESCE(NEW.financial_year_id::TEXT, 'null_fy'))
    );

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

    v_receipt := format('%s-%s-%s-%s',
        v_prefix,
        v_branch_code,
        to_char(v_day_date, 'YYMM'),
        lpad(v_next_number::TEXT, 5, '0')
    );

    NEW.receipt_number := v_receipt;

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
$function$;
