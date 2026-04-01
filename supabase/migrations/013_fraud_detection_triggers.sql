-- ============================================================
-- Migration 013: Fraud Detection Triggers
-- ============================================================
-- Automated fraud flag generation based on suspicious patterns.
-- All run as SECURITY DEFINER to bypass RLS for system writes.
-- ============================================================

-- ============================================================
-- 1. BACKDATED ENTRY DETECTION
-- Flags transactions where the cashbook day date is >1 day
-- before the actual entry time.
-- ============================================================
CREATE OR REPLACE FUNCTION detect_backdated_entry()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_day_date DATE;
BEGIN
    SELECT date INTO v_day_date
    FROM cashbook_days
    WHERE id = NEW.cashbook_day_id;

    -- If the transaction's day is more than 1 day before today
    IF v_day_date < (CURRENT_DATE - INTERVAL '1 day') THEN
        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            'backdated_entry',
            'medium',
            'cashbook_transactions',
            NEW.id,
            NEW.created_by,
            format('Transaction created for date %s (entry time: %s). Gap exceeds 1 day.',
                   v_day_date, NEW.created_at),
            jsonb_build_object(
                'day_date', v_day_date,
                'entry_time', NEW.created_at,
                'amount', NEW.amount,
                'receipt_number', NEW.receipt_number
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_backdated_entry
    AFTER INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION detect_backdated_entry();

-- ============================================================
-- 2. REPEATED RECEIPT EDIT DETECTION
-- Flags when a transaction has been revised more than 3 times
-- within a 24-hour window.
-- ============================================================
CREATE OR REPLACE FUNCTION detect_repeated_edits()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_edit_count INTEGER;
    v_txn RECORD;
BEGIN
    SELECT COUNT(*) INTO v_edit_count
    FROM transaction_revisions
    WHERE transaction_id = NEW.transaction_id
      AND changed_at > (now() - INTERVAL '24 hours');

    IF v_edit_count >= 3 THEN
        SELECT company_id, branch_id, receipt_number, amount
        INTO v_txn
        FROM cashbook_transactions
        WHERE id = NEW.transaction_id;

        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            v_txn.company_id,
            v_txn.branch_id,
            'repeated_receipt_edit',
            'high',
            'cashbook_transactions',
            NEW.transaction_id,
            NEW.changed_by,
            format('Transaction (receipt: %s) edited %s times in 24 hours.',
                   v_txn.receipt_number, v_edit_count),
            jsonb_build_object(
                'edit_count_24h', v_edit_count,
                'receipt_number', v_txn.receipt_number,
                'latest_change', NEW.field_changed,
                'changed_by', NEW.changed_by
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_repeated_edits
    AFTER INSERT ON transaction_revisions
    FOR EACH ROW EXECUTE FUNCTION detect_repeated_edits();

-- ============================================================
-- 3. HIGH CASH VARIANCE DETECTION
-- Flags when day closing variance exceeds 5% of system balance
-- or an absolute threshold (configurable, default 1000).
-- ============================================================
CREATE OR REPLACE FUNCTION detect_high_variance()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_variance_pct NUMERIC;
    v_abs_threshold NUMERIC := 1000;  -- default
    v_pct_threshold NUMERIC := 5;     -- default 5%
    v_config JSONB;
BEGIN
    -- Only trigger when status changes to 'closed' or 'closing'
    IF NEW.status NOT IN ('closed', 'closing') THEN
        RETURN NEW;
    END IF;

    -- Skip if no variance
    IF NEW.variance IS NULL OR NEW.variance = 0 THEN
        RETURN NEW;
    END IF;

    -- Try to get configurable thresholds
    SELECT config_value INTO v_config
    FROM company_configs
    WHERE company_id = NEW.company_id
      AND config_key = 'fraud_rules';

    IF v_config IS NOT NULL THEN
        v_abs_threshold := COALESCE((v_config ->> 'variance_abs_threshold')::NUMERIC, 1000);
        v_pct_threshold := COALESCE((v_config ->> 'variance_pct_threshold')::NUMERIC, 5);
    END IF;

    -- Calculate percentage variance
    IF NEW.system_closing != 0 THEN
        v_variance_pct := ABS(NEW.variance) / ABS(NEW.system_closing) * 100;
    ELSE
        v_variance_pct := 100;  -- Division by zero = flag it
    END IF;

    IF ABS(NEW.variance) > v_abs_threshold OR v_variance_pct > v_pct_threshold THEN
        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            'high_cash_variance',
            CASE
                WHEN v_variance_pct > 10 THEN 'critical'
                WHEN v_variance_pct > v_pct_threshold THEN 'high'
                ELSE 'high'
            END::fraud_severity,
            'cashbook_days',
            NEW.id,
            COALESCE(NEW.closed_by, '00000000-0000-0000-0000-000000000000'::UUID),
            format('Cash variance of %s detected (%.1f%%). System: %s, Physical: %s',
                   NEW.variance, v_variance_pct,
                   NEW.system_closing, NEW.physical_count),
            jsonb_build_object(
                'system_closing', NEW.system_closing,
                'physical_count', NEW.physical_count,
                'variance', NEW.variance,
                'variance_pct', v_variance_pct,
                'date', NEW.date,
                'cashbook_id', NEW.cashbook_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_high_variance
    AFTER UPDATE ON cashbook_days
    FOR EACH ROW
    WHEN (NEW.physical_count IS NOT NULL AND OLD.physical_count IS DISTINCT FROM NEW.physical_count)
    EXECUTE FUNCTION detect_high_variance();

-- ============================================================
-- 4. UNUSUAL VOID PATTERN DETECTION
-- Flags when a user voids >2 transactions in a single day.
-- ============================================================
CREATE OR REPLACE FUNCTION detect_unusual_void_pattern()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_void_count INTEGER;
BEGIN
    -- Only trigger on void action
    IF NOT (NEW.is_voided = TRUE AND OLD.is_voided = FALSE) THEN
        RETURN NEW;
    END IF;

    -- Count voids by this user today
    SELECT COUNT(*) INTO v_void_count
    FROM cashbook_transactions
    WHERE is_voided = TRUE
      AND voided_by = NEW.voided_by
      AND voided_at::DATE = CURRENT_DATE
      AND company_id = NEW.company_id;

    IF v_void_count > 2 THEN
        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            'unusual_void_pattern',
            'critical',
            'cashbook_transactions',
            NEW.id,
            NEW.voided_by,
            format('User has voided %s transactions today. Unusual pattern detected.',
                   v_void_count),
            jsonb_build_object(
                'void_count_today', v_void_count,
                'voided_by', NEW.voided_by,
                'latest_void_reason', NEW.void_reason,
                'receipt_number', NEW.receipt_number,
                'amount', NEW.amount
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_unusual_voids
    AFTER UPDATE ON cashbook_transactions
    FOR EACH ROW
    WHEN (NEW.is_voided = TRUE AND OLD.is_voided = FALSE)
    EXECUTE FUNCTION detect_unusual_void_pattern();

-- ============================================================
-- 5. RAPID TRANSACTIONS DETECTION
-- Flags when a user creates >10 transactions within 30 minutes.
-- ============================================================
CREATE OR REPLACE FUNCTION detect_rapid_transactions()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_txn_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_txn_count
    FROM cashbook_transactions
    WHERE created_by = NEW.created_by
      AND company_id = NEW.company_id
      AND created_at > (now() - INTERVAL '30 minutes')
      AND id != NEW.id;

    IF v_txn_count >= 10 THEN
        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            'rapid_transactions',
            'medium',
            'cashbook_transactions',
            NEW.id,
            NEW.created_by,
            format('User created %s transactions in the last 30 minutes.',
                   v_txn_count + 1),
            jsonb_build_object(
                'txn_count_30min', v_txn_count + 1,
                'user_id', NEW.created_by,
                'latest_amount', NEW.amount,
                'latest_receipt', NEW.receipt_number
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_rapid_transactions
    AFTER INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION detect_rapid_transactions();

-- ============================================================
-- 6. THRESHOLD BREACH DETECTION
-- Flags single transactions exceeding a configurable threshold.
-- ============================================================
CREATE OR REPLACE FUNCTION detect_threshold_breach()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_threshold NUMERIC := 500000;  -- Default 5 lakh
    v_config JSONB;
BEGIN
    -- Get configurable threshold
    SELECT config_value INTO v_config
    FROM company_configs
    WHERE company_id = NEW.company_id
      AND config_key = 'fraud_rules';

    IF v_config IS NOT NULL THEN
        v_threshold := COALESCE(
            (v_config ->> 'high_value_txn_threshold')::NUMERIC,
            500000
        );
    END IF;

    IF NEW.amount >= v_threshold THEN
        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            'threshold_breach',
            'medium',
            'cashbook_transactions',
            NEW.id,
            NEW.created_by,
            format('High-value transaction of %s recorded (threshold: %s).',
                   NEW.amount, v_threshold),
            jsonb_build_object(
                'amount', NEW.amount,
                'threshold', v_threshold,
                'payment_mode', NEW.payment_mode,
                'receipt_number', NEW.receipt_number,
                'narration', NEW.narration
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_threshold_breach
    AFTER INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION detect_threshold_breach();

-- ============================================================
-- 7. OFF-HOURS ACTIVITY DETECTION
-- Flags transactions created outside business hours.
-- Default: before 8 AM or after 10 PM (configurable).
-- ============================================================
CREATE OR REPLACE FUNCTION detect_off_hours_activity()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_hour INTEGER;
    v_start_hour INTEGER := 8;   -- Default 8 AM
    v_end_hour INTEGER := 22;    -- Default 10 PM
    v_config JSONB;
BEGIN
    v_hour := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'Asia/Kolkata');

    -- Get configurable hours
    SELECT config_value INTO v_config
    FROM company_configs
    WHERE company_id = NEW.company_id
      AND config_key = 'fraud_rules';

    IF v_config IS NOT NULL THEN
        v_start_hour := COALESCE((v_config ->> 'business_start_hour')::INTEGER, 8);
        v_end_hour := COALESCE((v_config ->> 'business_end_hour')::INTEGER, 22);
    END IF;

    IF v_hour < v_start_hour OR v_hour >= v_end_hour THEN
        INSERT INTO fraud_flags (
            company_id, branch_id, flag_type, severity,
            entity_type, entity_id, user_id, description, metadata
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            'off_hours_activity',
            'low',
            'cashbook_transactions',
            NEW.id,
            NEW.created_by,
            format('Transaction created at %s IST (outside business hours %s:00-%s:00).',
                   (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::TIME,
                   v_start_hour, v_end_hour),
            jsonb_build_object(
                'created_at_ist', NEW.created_at AT TIME ZONE 'Asia/Kolkata',
                'hour', v_hour,
                'business_start', v_start_hour,
                'business_end', v_end_hour,
                'amount', NEW.amount,
                'receipt_number', NEW.receipt_number
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_off_hours
    AFTER INSERT ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION detect_off_hours_activity();
