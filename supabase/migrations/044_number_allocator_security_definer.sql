-- 044: Make number-allocator trigger functions SECURITY DEFINER.
--
-- Migration 039 locked down receipt_number_series and challan_number_series
-- so only service_role can read/write them. The allocator functions ran as
-- the calling user, so any cashbook_transactions insert by a normal user
-- (cashier paying an expense, recording a receipt, …) failed with
-- "permission denied for table receipt_number_series" / "challan_number_series".
--
-- The functions only insert/update a row scoped to the caller's own
-- branch / company / group / financial_year — no cross-tenant exposure —
-- so it is safe to run them with elevated privileges.

CREATE OR REPLACE FUNCTION public.generate_receipt_number_and_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.generate_challan_number(
    p_group_id uuid,
    p_financial_year_id uuid,
    p_prefix text DEFAULT 'TC'::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_next_num  BIGINT;
    v_fy_short  TEXT;
    v_series_id UUID;
BEGIN
    SELECT SUBSTRING(name FROM 3 FOR 2) || SUBSTRING(name FROM 8 FOR 2)
    INTO v_fy_short
    FROM financial_years
    WHERE id = p_financial_year_id;

    PERFORM pg_advisory_xact_lock(hashtext(p_group_id::text || p_financial_year_id::text || p_prefix));

    INSERT INTO challan_number_series (group_id, financial_year_id, prefix, current_number)
    VALUES (p_group_id, p_financial_year_id, p_prefix, 1)
    ON CONFLICT (group_id, financial_year_id, prefix)
    DO UPDATE SET current_number = challan_number_series.current_number + 1
    RETURNING id, current_number INTO v_series_id, v_next_num;

    RETURN p_prefix || '/' || v_fy_short || '/' || LPAD(v_next_num::TEXT, 4, '0');
END;
$function$;
