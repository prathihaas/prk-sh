-- ============================================================
-- Migration 018: Rename audit_log + fraud_flags columns
--                to match frontend code column names
-- ============================================================

-- ── audit_log ────────────────────────────────────────────────
ALTER TABLE audit_log RENAME COLUMN user_id     TO changed_by;
ALTER TABLE audit_log RENAME COLUMN entity_type TO table_name;
ALTER TABLE audit_log RENAME COLUMN entity_id   TO record_id;
ALTER TABLE audit_log RENAME COLUMN old_values  TO old_data;
ALTER TABLE audit_log RENAME COLUMN new_values  TO new_data;

-- ── fraud_flags ──────────────────────────────────────────────
ALTER TABLE fraud_flags RENAME COLUMN entity_type TO table_name;
ALTER TABLE fraud_flags RENAME COLUMN entity_id   TO record_id;

-- ── Update trigger functions that INSERT into audit_log ───────
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_action     audit_action;
    v_company_id UUID;
    v_branch_id  UUID;
    v_user_id    UUID;
    v_old        JSONB;
    v_new        JSONB;
    v_record_id  UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT'; v_new := to_jsonb(NEW); v_old := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE'; v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'UPDATE'; v_old := to_jsonb(OLD); v_new := NULL;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_company_id := (to_jsonb(OLD) ->> 'company_id')::UUID;
        v_branch_id  := (to_jsonb(OLD) ->> 'branch_id')::UUID;
        v_record_id  := (to_jsonb(OLD) ->> 'id')::UUID;
    ELSE
        v_company_id := (to_jsonb(NEW) ->> 'company_id')::UUID;
        v_branch_id  := (to_jsonb(NEW) ->> 'branch_id')::UUID;
        v_record_id  := (to_jsonb(NEW) ->> 'id')::UUID;
    END IF;

    v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID);

    IF TG_OP = 'UPDATE' AND v_old = v_new THEN RETURN NEW; END IF;

    INSERT INTO audit_log (company_id, branch_id, changed_by, action, table_name, record_id, old_data, new_data)
    VALUES (
        COALESCE(v_company_id, '00000000-0000-0000-0000-000000000000'::UUID),
        v_branch_id, v_user_id, v_action, TG_TABLE_NAME,
        COALESCE(v_record_id, '00000000-0000-0000-0000-000000000000'::UUID),
        v_old, v_new
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_day_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_action audit_action;
BEGIN
    IF OLD.status != NEW.status THEN
        CASE NEW.status
            WHEN 'closed'   THEN v_action := 'CLOSE';
            WHEN 'reopened' THEN v_action := 'REOPEN';
            ELSE v_action := 'UPDATE';
        END CASE;
        INSERT INTO audit_log (company_id, branch_id, changed_by, action, table_name, record_id, old_data, new_data, change_reason)
        VALUES (
            NEW.company_id, NEW.branch_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            v_action, 'cashbook_days', NEW.id,
            jsonb_build_object('status', OLD.status, 'system_closing', OLD.system_closing, 'physical_count', OLD.physical_count),
            jsonb_build_object('status', NEW.status, 'system_closing', NEW.system_closing, 'physical_count', NEW.physical_count,
                               'variance', NEW.variance, 'closed_by', NEW.closed_by, 'reopened_by', NEW.reopened_by,
                               'reopen_reason', NEW.reopen_reason),
            COALESCE(NEW.reopen_reason, 'Day status changed to ' || NEW.status::TEXT)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_fy_lock_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
        INSERT INTO audit_log (company_id, branch_id, changed_by, action, table_name, record_id, old_data, new_data)
        VALUES (
            NEW.company_id, NULL,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            CASE WHEN NEW.is_locked THEN 'LOCK'::audit_action ELSE 'UNLOCK'::audit_action END,
            'financial_years', NEW.id,
            jsonb_build_object('is_locked', OLD.is_locked),
            jsonb_build_object('is_locked', NEW.is_locked, 'locked_by', NEW.locked_by)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_void_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.is_voided = TRUE AND OLD.is_voided = FALSE THEN
        INSERT INTO audit_log (company_id, branch_id, changed_by, action, table_name, record_id, old_data, new_data, change_reason)
        VALUES (
            NEW.company_id, NEW.branch_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            'VOID', 'cashbook_transactions', NEW.id,
            jsonb_build_object('is_voided', OLD.is_voided, 'amount', OLD.amount, 'receipt_number', OLD.receipt_number),
            jsonb_build_object('is_voided', NEW.is_voided, 'void_reason', NEW.void_reason, 'voided_by', NEW.voided_by),
            NEW.void_reason
        );
    END IF;
    RETURN NEW;
END;
$$;
