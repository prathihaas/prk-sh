-- ============================================================
-- Migration 007: HR Module — Employees, Attendance, Payroll
-- ============================================================

-- ========================
-- EMPLOYEES
-- ========================
CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    user_id         UUID REFERENCES user_profiles(id),
    employee_code   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    designation     TEXT,
    department      TEXT,

    -- Compensation
    ctc_annual      NUMERIC(18,2) NOT NULL,
    basic_salary    NUMERIC(18,2) NOT NULL,
    hra             NUMERIC(18,2) NOT NULL DEFAULT 0,
    other_allowances NUMERIC(18,2) NOT NULL DEFAULT 0,

    -- Statutory applicability
    pf_applicable   BOOLEAN NOT NULL DEFAULT TRUE,
    esi_applicable  BOOLEAN NOT NULL DEFAULT FALSE,
    pt_applicable   BOOLEAN NOT NULL DEFAULT TRUE,

    -- Bank details
    bank_name       TEXT,
    bank_account_no TEXT,
    bank_ifsc       TEXT,

    -- Dates & Status
    joining_date    DATE NOT NULL,
    exit_date       DATE,
    status          employee_status NOT NULL DEFAULT 'active',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_employee_code UNIQUE (company_id, employee_code),
    CONSTRAINT chk_ctc_positive CHECK (ctc_annual > 0),
    CONSTRAINT chk_basic_positive CHECK (basic_salary > 0)
);

CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_user ON employees(user_id);

CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- ATTENDANCE PERIODS
-- ========================
CREATE TABLE attendance_periods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    month       INTEGER NOT NULL,
    year        INTEGER NOT NULL,
    status      period_status NOT NULL DEFAULT 'open',
    closed_by   UUID REFERENCES user_profiles(id),
    closed_at   TIMESTAMPTZ,
    approved_by UUID REFERENCES user_profiles(id),
    approved_at TIMESTAMPTZ,

    CONSTRAINT uq_attendance_period UNIQUE (company_id, branch_id, month, year),
    CONSTRAINT chk_month_range CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT chk_year_range CHECK (year BETWEEN 2000 AND 2100)
);

CREATE INDEX idx_att_periods_company ON attendance_periods(company_id);
CREATE INDEX idx_att_periods_branch ON attendance_periods(branch_id);

-- ========================
-- ATTENDANCE RECORDS
-- ========================
CREATE TABLE attendance_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    period_id       UUID NOT NULL REFERENCES attendance_periods(id) ON DELETE RESTRICT,
    date            DATE NOT NULL,
    status          attendance_status NOT NULL,
    is_late         BOOLEAN NOT NULL DEFAULT FALSE,
    check_in_time   TIME,
    check_out_time  TIME,
    remarks         TEXT,
    marked_by       UUID NOT NULL REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_attendance_record UNIQUE (employee_id, date)
);

CREATE INDEX idx_att_records_employee ON attendance_records(employee_id);
CREATE INDEX idx_att_records_period ON attendance_records(period_id);
CREATE INDEX idx_att_records_company ON attendance_records(company_id);
CREATE INDEX idx_att_records_date ON attendance_records(date);

CREATE TRIGGER trg_att_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Prevent editing attendance after period is closed
CREATE OR REPLACE FUNCTION prevent_closed_attendance_edit()
RETURNS TRIGGER AS $$
DECLARE
    v_period_status period_status;
BEGIN
    SELECT status INTO v_period_status
    FROM attendance_periods
    WHERE id = NEW.period_id;

    IF v_period_status = 'closed' THEN
        RAISE EXCEPTION 'Cannot modify attendance: period % is closed', NEW.period_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_closed_attendance
    BEFORE INSERT OR UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION prevent_closed_attendance_edit();

-- ========================
-- LEAVE BALANCES
-- ========================
CREATE TABLE leave_balances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    financial_year_id   UUID REFERENCES financial_years(id),
    leave_type          leave_type NOT NULL,
    total_days          NUMERIC(4,1) NOT NULL,
    used_days           NUMERIC(4,1) NOT NULL DEFAULT 0,
    balance_days        NUMERIC(4,1) GENERATED ALWAYS AS (
                            total_days - used_days
                        ) STORED,

    CONSTRAINT uq_leave_balance UNIQUE (employee_id, financial_year_id, leave_type),
    CONSTRAINT chk_leave_total CHECK (total_days >= 0),
    CONSTRAINT chk_leave_used CHECK (used_days >= 0),
    CONSTRAINT chk_leave_used_lte_total CHECK (used_days <= total_days)
);

CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);
CREATE INDEX idx_leave_balances_company ON leave_balances(company_id);

-- ========================
-- PAYROLL RUNS
-- ========================
CREATE TABLE payroll_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    month               INTEGER NOT NULL,
    year                INTEGER NOT NULL,
    status              payroll_status NOT NULL DEFAULT 'draft',
    total_gross         NUMERIC(18,2),
    total_deductions    NUMERIC(18,2),
    total_net           NUMERIC(18,2),
    processed_by        UUID REFERENCES user_profiles(id),
    processed_at        TIMESTAMPTZ,
    locked_by           UUID REFERENCES user_profiles(id),
    locked_at           TIMESTAMPTZ,
    reopened_by         UUID REFERENCES user_profiles(id),
    reopened_at         TIMESTAMPTZ,
    reopen_reason       TEXT,
    reopen_approved_by  UUID REFERENCES user_profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_payroll_run UNIQUE (company_id, branch_id, month, year),
    CONSTRAINT chk_payroll_month CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT chk_payroll_year CHECK (year BETWEEN 2000 AND 2100)
);

CREATE INDEX idx_payroll_runs_company ON payroll_runs(company_id);
CREATE INDEX idx_payroll_runs_branch ON payroll_runs(branch_id);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);

-- ========================
-- PAYROLL ENTRIES
-- ========================
CREATE TABLE payroll_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id      UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
    employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,

    -- Attendance summary
    days_present        NUMERIC(4,1) NOT NULL,
    days_absent         NUMERIC(4,1) NOT NULL,
    late_days           INTEGER NOT NULL DEFAULT 0,

    -- Earnings
    basic_earned        NUMERIC(18,2) NOT NULL,
    hra_earned          NUMERIC(18,2) NOT NULL DEFAULT 0,
    allowances_earned   NUMERIC(18,2) NOT NULL DEFAULT 0,
    overtime_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
    bonus_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
    gross_salary        NUMERIC(18,2) NOT NULL,

    -- Deductions
    pf_employee         NUMERIC(18,2) NOT NULL DEFAULT 0,
    pf_employer         NUMERIC(18,2) NOT NULL DEFAULT 0,
    esi_employee        NUMERIC(18,2) NOT NULL DEFAULT 0,
    esi_employer        NUMERIC(18,2) NOT NULL DEFAULT 0,
    pt_amount           NUMERIC(18,2) NOT NULL DEFAULT 0,
    tds_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
    other_deductions    NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_deductions    NUMERIC(18,2) NOT NULL,

    net_salary          NUMERIC(18,2) GENERATED ALWAYS AS (
                            gross_salary - total_deductions
                        ) STORED,

    payslip_url         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_payroll_entry UNIQUE (payroll_run_id, employee_id),
    CONSTRAINT chk_gross_positive CHECK (gross_salary >= 0)
);

CREATE INDEX idx_payroll_entries_run ON payroll_entries(payroll_run_id);
CREATE INDEX idx_payroll_entries_employee ON payroll_entries(employee_id);
CREATE INDEX idx_payroll_entries_company ON payroll_entries(company_id);

-- Prevent modification of locked payroll
CREATE OR REPLACE FUNCTION prevent_locked_payroll_edit()
RETURNS TRIGGER AS $$
DECLARE
    v_status payroll_status;
BEGIN
    SELECT status INTO v_status
    FROM payroll_runs
    WHERE id = NEW.payroll_run_id;

    IF v_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot modify payroll entry: payroll run % is locked',
            NEW.payroll_run_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_payroll
    BEFORE INSERT OR UPDATE ON payroll_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_locked_payroll_edit();

-- ============================================================
-- Payroll Calculation Helper Function
-- Called via RPC from the application to process payroll
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_payroll_entry(
    p_employee_id UUID,
    p_payroll_run_id UUID,
    p_total_working_days NUMERIC(4,1)
)
RETURNS payroll_entries AS $$
DECLARE
    v_employee employees%ROWTYPE;
    v_run payroll_runs%ROWTYPE;
    v_days_present NUMERIC(4,1);
    v_days_absent NUMERIC(4,1);
    v_late_days INTEGER;
    v_per_day_basic NUMERIC(18,2);
    v_per_day_hra NUMERIC(18,2);
    v_per_day_allowances NUMERIC(18,2);
    v_basic_earned NUMERIC(18,2);
    v_hra_earned NUMERIC(18,2);
    v_allowances_earned NUMERIC(18,2);
    v_gross NUMERIC(18,2);
    v_pf_employee NUMERIC(18,2) := 0;
    v_pf_employer NUMERIC(18,2) := 0;
    v_esi_employee NUMERIC(18,2) := 0;
    v_esi_employer NUMERIC(18,2) := 0;
    v_pt NUMERIC(18,2) := 0;
    v_total_deductions NUMERIC(18,2);
    v_result payroll_entries%ROWTYPE;
BEGIN
    -- Get employee details
    SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', p_employee_id;
    END IF;

    -- Get payroll run
    SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll run % not found', p_payroll_run_id;
    END IF;

    -- Count attendance
    SELECT
        COUNT(*) FILTER (WHERE ar.status IN ('present', 'half_day', 'holiday', 'weekly_off')),
        COUNT(*) FILTER (WHERE ar.status IN ('absent', 'leave')),
        COUNT(*) FILTER (WHERE ar.is_late = TRUE)
    INTO v_days_present, v_days_absent, v_late_days
    FROM attendance_records ar
    JOIN attendance_periods ap ON ap.id = ar.period_id
    WHERE ar.employee_id = p_employee_id
      AND ap.month = v_run.month
      AND ap.year = v_run.year
      AND ap.branch_id = v_run.branch_id;

    -- Half days count as 0.5
    SELECT
        COALESCE(SUM(
            CASE WHEN ar.status = 'half_day' THEN 0.5
                 WHEN ar.status IN ('present', 'holiday', 'weekly_off') THEN 1
                 ELSE 0 END
        ), 0)
    INTO v_days_present
    FROM attendance_records ar
    JOIN attendance_periods ap ON ap.id = ar.period_id
    WHERE ar.employee_id = p_employee_id
      AND ap.month = v_run.month
      AND ap.year = v_run.year
      AND ap.branch_id = v_run.branch_id;

    v_days_absent := p_total_working_days - v_days_present;
    IF v_days_absent < 0 THEN v_days_absent := 0; END IF;

    -- Calculate per-day rates (monthly = annual / 12)
    v_per_day_basic := (v_employee.basic_salary / p_total_working_days);
    v_per_day_hra := (v_employee.hra / p_total_working_days);
    v_per_day_allowances := (v_employee.other_allowances / p_total_working_days);

    -- Earnings based on attendance
    v_basic_earned := ROUND(v_per_day_basic * v_days_present, 2);
    v_hra_earned := ROUND(v_per_day_hra * v_days_present, 2);
    v_allowances_earned := ROUND(v_per_day_allowances * v_days_present, 2);
    v_gross := v_basic_earned + v_hra_earned + v_allowances_earned;

    -- PF: 12% of basic (employee), 12% of basic (employer)
    -- Capped at basic of 15000/month
    IF v_employee.pf_applicable THEN
        DECLARE
            v_pf_base NUMERIC(18,2);
        BEGIN
            v_pf_base := LEAST(v_basic_earned, 15000);
            v_pf_employee := ROUND(v_pf_base * 0.12, 2);
            v_pf_employer := ROUND(v_pf_base * 0.12, 2);
        END;
    END IF;

    -- ESI: 0.75% employee, 3.25% employer (if gross <= 21000)
    IF v_employee.esi_applicable AND v_gross <= 21000 THEN
        v_esi_employee := ROUND(v_gross * 0.0075, 2);
        v_esi_employer := ROUND(v_gross * 0.0325, 2);
    END IF;

    -- Professional Tax (basic slab — varies by state)
    -- Using common slab: gross > 15000 → 200, else 0
    IF v_employee.pt_applicable THEN
        IF v_gross > 15000 THEN
            v_pt := 200;
        ELSE
            v_pt := 0;
        END IF;
    END IF;

    v_total_deductions := v_pf_employee + v_esi_employee + v_pt;

    -- Insert the payroll entry
    INSERT INTO payroll_entries (
        payroll_run_id, employee_id, company_id,
        days_present, days_absent, late_days,
        basic_earned, hra_earned, allowances_earned,
        gross_salary,
        pf_employee, pf_employer,
        esi_employee, esi_employer,
        pt_amount, total_deductions
    ) VALUES (
        p_payroll_run_id, p_employee_id, v_employee.company_id,
        v_days_present, v_days_absent, v_late_days,
        v_basic_earned, v_hra_earned, v_allowances_earned,
        v_gross,
        v_pf_employee, v_pf_employer,
        v_esi_employee, v_esi_employer,
        v_pt, v_total_deductions
    )
    ON CONFLICT (payroll_run_id, employee_id)
    DO UPDATE SET
        days_present = EXCLUDED.days_present,
        days_absent = EXCLUDED.days_absent,
        late_days = EXCLUDED.late_days,
        basic_earned = EXCLUDED.basic_earned,
        hra_earned = EXCLUDED.hra_earned,
        allowances_earned = EXCLUDED.allowances_earned,
        gross_salary = EXCLUDED.gross_salary,
        pf_employee = EXCLUDED.pf_employee,
        pf_employer = EXCLUDED.pf_employer,
        esi_employee = EXCLUDED.esi_employee,
        esi_employer = EXCLUDED.esi_employer,
        pt_amount = EXCLUDED.pt_amount,
        total_deductions = EXCLUDED.total_deductions
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
