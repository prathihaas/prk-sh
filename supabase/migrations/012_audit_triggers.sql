-- ============================================================
-- Migration 012: Audit Trigger Functions
-- ============================================================
-- Generic audit logger that can be attached to any table.
-- Captures INSERT, UPDATE with full old/new values.
-- Runs as SECURITY DEFINER to bypass RLS on audit_log.
-- ============================================================

-- ============================================================
-- GENERIC AUDIT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_action audit_action;
    v_company_id UUID;
    v_branch_id UUID;
    v_user_id UUID;
    v_old JSONB;
    v_new JSONB;
    v_entity_id UUID;
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_new := to_jsonb(NEW);
        v_old := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        -- Should not happen on financial tables, but log it
        v_action := 'UPDATE';
        v_old := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Extract company_id (try multiple column names)
    IF TG_OP = 'DELETE' THEN
        v_company_id := (to_jsonb(OLD) ->> 'company_id')::UUID;
        v_branch_id := (to_jsonb(OLD) ->> 'branch_id')::UUID;
        v_entity_id := (to_jsonb(OLD) ->> 'id')::UUID;
    ELSE
        v_company_id := (to_jsonb(NEW) ->> 'company_id')::UUID;
        v_branch_id := (to_jsonb(NEW) ->> 'branch_id')::UUID;
        v_entity_id := (to_jsonb(NEW) ->> 'id')::UUID;
    END IF;

    -- Get current user
    v_user_id := COALESCE(
        auth.uid(),
        '00000000-0000-0000-0000-000000000000'::UUID  -- system user for triggers
    );

    -- For UPDATE, only log if something actually changed
    IF TG_OP = 'UPDATE' AND v_old = v_new THEN
        RETURN NEW;
    END IF;

    -- Insert audit record
    INSERT INTO audit_log (
        company_id, branch_id, user_id, action,
        entity_type, entity_id, old_values, new_values
    ) VALUES (
        COALESCE(v_company_id, '00000000-0000-0000-0000-000000000000'::UUID),
        v_branch_id,
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        COALESCE(v_entity_id, '00000000-0000-0000-0000-000000000000'::UUID),
        v_old,
        v_new
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================
-- ATTACH AUDIT TRIGGERS TO ALL CRITICAL TABLES
-- ============================================================

-- Financial tables (highest priority)
CREATE TRIGGER audit_cashbook_transactions
    AFTER INSERT OR UPDATE ON cashbook_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_cashbook_days
    AFTER INSERT OR UPDATE ON cashbook_days
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_cashbooks
    AFTER INSERT OR UPDATE ON cashbooks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_transaction_revisions
    AFTER INSERT ON transaction_revisions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Invoice & Expense tables
CREATE TRIGGER audit_invoices
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_invoice_payments
    AFTER INSERT ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_expenses
    AFTER INSERT OR UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- HR tables
CREATE TRIGGER audit_employees
    AFTER INSERT OR UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_attendance_records
    AFTER INSERT OR UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_attendance_periods
    AFTER INSERT OR UPDATE ON attendance_periods
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payroll_runs
    AFTER INSERT OR UPDATE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payroll_entries
    AFTER INSERT OR UPDATE ON payroll_entries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Workflow tables
CREATE TRIGGER audit_approval_requests
    AFTER INSERT OR UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_approval_steps
    AFTER INSERT OR UPDATE ON approval_steps
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Access control
CREATE TRIGGER audit_user_assignments
    AFTER INSERT OR UPDATE ON user_assignments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Organizational
CREATE TRIGGER audit_companies
    AFTER INSERT OR UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_branches
    AFTER INSERT OR UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_financial_years
    AFTER INSERT OR UPDATE ON financial_years
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- SPECIALIZED AUDIT: Log void operations distinctly
-- ============================================================
CREATE OR REPLACE FUNCTION audit_void_transaction()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_voided = TRUE AND OLD.is_voided = FALSE THEN
        INSERT INTO audit_log (
            company_id, branch_id, user_id, action,
            entity_type, entity_id, old_values, new_values,
            change_reason
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            'VOID',
            'cashbook_transactions',
            NEW.id,
            jsonb_build_object(
                'is_voided', OLD.is_voided,
                'amount', OLD.amount,
                'receipt_number', OLD.receipt_number
            ),
            jsonb_build_object(
                'is_voided', NEW.is_voided,
                'void_reason', NEW.void_reason,
                'voided_by', NEW.voided_by
            ),
            NEW.void_reason
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_void_txn
    AFTER UPDATE ON cashbook_transactions
    FOR EACH ROW
    WHEN (NEW.is_voided = TRUE AND OLD.is_voided = FALSE)
    EXECUTE FUNCTION audit_void_transaction();

-- ============================================================
-- SPECIALIZED AUDIT: Log day close/reopen operations
-- ============================================================
CREATE OR REPLACE FUNCTION audit_day_status_change()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_action audit_action;
BEGIN
    IF OLD.status != NEW.status THEN
        CASE NEW.status
            WHEN 'closed' THEN v_action := 'CLOSE';
            WHEN 'reopened' THEN v_action := 'REOPEN';
            ELSE v_action := 'UPDATE';
        END CASE;

        INSERT INTO audit_log (
            company_id, branch_id, user_id, action,
            entity_type, entity_id, old_values, new_values,
            change_reason
        ) VALUES (
            NEW.company_id,
            NEW.branch_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            v_action,
            'cashbook_days',
            NEW.id,
            jsonb_build_object(
                'status', OLD.status,
                'system_closing', OLD.system_closing,
                'physical_count', OLD.physical_count
            ),
            jsonb_build_object(
                'status', NEW.status,
                'system_closing', NEW.system_closing,
                'physical_count', NEW.physical_count,
                'variance', NEW.variance,
                'closed_by', NEW.closed_by,
                'reopened_by', NEW.reopened_by,
                'reopen_reason', NEW.reopen_reason
            ),
            COALESCE(NEW.reopen_reason, 'Day status changed to ' || NEW.status::TEXT)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_day_status
    AFTER UPDATE ON cashbook_days
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION audit_day_status_change();

-- ============================================================
-- SPECIALIZED AUDIT: Log financial year lock/unlock
-- ============================================================
CREATE OR REPLACE FUNCTION audit_fy_lock_change()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
        INSERT INTO audit_log (
            company_id, branch_id, user_id, action,
            entity_type, entity_id, old_values, new_values
        ) VALUES (
            NEW.company_id,
            NULL,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            CASE WHEN NEW.is_locked THEN 'LOCK'::audit_action
                 ELSE 'UNLOCK'::audit_action END,
            'financial_years',
            NEW.id,
            jsonb_build_object('is_locked', OLD.is_locked),
            jsonb_build_object('is_locked', NEW.is_locked,
                               'locked_by', NEW.locked_by)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_fy_lock
    AFTER UPDATE ON financial_years
    FOR EACH ROW
    WHEN (OLD.is_locked IS DISTINCT FROM NEW.is_locked)
    EXECUTE FUNCTION audit_fy_lock_change();
