-- 050: Receipt-number generator now always resolves the financial_year_id
-- at trigger time from the cashbook_day's date. Previously, when a caller
-- inserted with financial_year_id = NULL (forms that didn't pass the FY),
-- the series row got keyed to (branch, NULL, 'RCP') and ran a parallel
-- counter from the (branch, real_fy, 'RCP') series. Eventually both
-- counters reached the same number — producing two transactions that
-- shared receipt_number e.g. 'RCP-NZB-2605-00012', which violated the
-- global UNIQUE(company_id, receipt_number) constraint and broke every
-- new receipt save with "duplicate key value violates unique constraint
-- uq_txn_receipt_number".

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

    SELECT code INTO v_branch_code
    FROM branches
    WHERE id = NEW.branch_id;

    -- Resolve the FY that covers v_day_date for this company.
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
        hashtext(NEW.branch_id::TEXT || COALESCE(v_fy_id::TEXT, 'null_fy'))
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

-- ── One-time data fix: collapse NULL-FY series rows into the real-FY row.
-- For each branch with a NULL-FY series, take its current_number and merge
-- into the (branch, today's-FY, prefix) row using GREATEST. Then drop the
-- NULL row. After this, every branch has at most one active series row
-- per FY and new allocations will continue past the highest issued number.

WITH today_fy AS (
  SELECT b.id AS branch_id, b.company_id, fy.id AS fy_id
  FROM branches b
  JOIN financial_years fy
    ON fy.company_id = b.company_id
   AND fy.is_active = TRUE
   AND CURRENT_DATE BETWEEN fy.start_date AND fy.end_date
),
orphan AS (
  SELECT s.branch_id, s.prefix, s.current_number, tf.company_id, tf.fy_id
  FROM receipt_number_series s
  JOIN today_fy tf ON tf.branch_id = s.branch_id
  WHERE s.financial_year_id IS NULL
)
INSERT INTO receipt_number_series (branch_id, company_id, financial_year_id, prefix, current_number)
SELECT branch_id, company_id, fy_id, prefix, current_number
FROM orphan
ON CONFLICT ON CONSTRAINT uq_receipt_series DO UPDATE
  SET current_number = GREATEST(receipt_number_series.current_number, EXCLUDED.current_number);

DELETE FROM receipt_number_series s
WHERE s.financial_year_id IS NULL
  AND EXISTS (
    SELECT 1 FROM branches b
    JOIN financial_years fy
      ON fy.company_id = b.company_id
     AND fy.is_active = TRUE
     AND CURRENT_DATE BETWEEN fy.start_date AND fy.end_date
    WHERE b.id = s.branch_id
  );
