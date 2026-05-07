-- 052: Allow branch_id IS NULL on receipt_number_series so company-level
-- (no-branch) cashbook transactions — typically inter-cashbook transfers
-- where the source / destination is a company-wide bank account — can
-- generate a receipt number too. Without this, the debit leg of a transfer
-- failed with:
--   null value in column "branch_id" of relation "receipt_number_series"
--   violates not-null constraint
--
-- The unique constraint uq_receipt_series is already NULLS NOT DISTINCT, so
-- (NULL, fy, prefix) is treated as a single counter — no duplicate-row risk.
-- The trigger uses a static 'CO' suffix in place of branch_code when no
-- branch is present, so the receipt_number stays unique and parseable.

ALTER TABLE public.receipt_number_series
  ALTER COLUMN branch_id DROP NOT NULL;

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
    v_fy_id        UUID;
    v_salt         TEXT := 'prk_erp_2025_salt';
BEGIN
    SELECT date INTO v_day_date
    FROM cashbook_days
    WHERE id = NEW.cashbook_day_id;

    IF NEW.branch_id IS NOT NULL THEN
        SELECT code INTO v_branch_code
        FROM branches
        WHERE id = NEW.branch_id;
    END IF;

    -- Sentinel for company-level (branchless) transactions, e.g. transfers
    -- through a company-wide bank cashbook.
    IF v_branch_code IS NULL THEN
        v_branch_code := 'CO';
    END IF;

    SELECT id INTO v_fy_id
      FROM financial_years
     WHERE company_id = NEW.company_id
       AND v_day_date BETWEEN start_date AND end_date
       AND is_active = TRUE
     ORDER BY start_date DESC
     LIMIT 1;

    IF v_fy_id IS NULL THEN
        SELECT id INTO v_fy_id
          FROM financial_years
         WHERE company_id = NEW.company_id
           AND is_active = TRUE
         ORDER BY start_date DESC
         LIMIT 1;
    END IF;

    IF v_fy_id IS NULL THEN
        v_fy_id := NEW.financial_year_id;
    END IF;

    NEW.financial_year_id := v_fy_id;

    PERFORM pg_advisory_xact_lock(
        hashtext(
            COALESCE(NEW.branch_id::TEXT, 'null_branch') || '|' ||
            COALESCE(v_fy_id::TEXT, 'null_fy')
        )
    );

    INSERT INTO receipt_number_series (
        branch_id, company_id, financial_year_id, prefix, current_number
    ) VALUES (
        NEW.branch_id,
        NEW.company_id,
        v_fy_id,
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
