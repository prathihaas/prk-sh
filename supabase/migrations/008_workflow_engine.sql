-- ============================================================
-- Migration 008: Workflow & Approval Engine
-- ============================================================

-- ========================
-- APPROVAL MATRIX (Configurable per company/branch)
-- ========================
CREATE TABLE approval_matrix (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id           UUID REFERENCES branches(id) ON DELETE RESTRICT,
    entity_type         approval_entity_type NOT NULL,
    threshold_amount    NUMERIC(18,2),      -- NULL = applies to all amounts
    step_order          INTEGER NOT NULL,
    approver_role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One step per order per entity type per scope
    CONSTRAINT uq_approval_matrix UNIQUE NULLS NOT DISTINCT
        (company_id, branch_id, entity_type, threshold_amount, step_order)
);

CREATE INDEX idx_approval_matrix_company ON approval_matrix(company_id);
CREATE INDEX idx_approval_matrix_entity ON approval_matrix(entity_type);

-- ========================
-- APPROVAL REQUESTS
-- ========================
CREATE TABLE approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    entity_type     approval_entity_type NOT NULL,
    entity_id       UUID NOT NULL,
    current_step    INTEGER NOT NULL DEFAULT 1,
    total_steps     INTEGER NOT NULL,
    status          approval_status NOT NULL DEFAULT 'pending',
    requested_by    UUID NOT NULL REFERENCES user_profiles(id),
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_req_company ON approval_requests(company_id);
CREATE INDEX idx_approval_req_entity ON approval_requests(entity_type, entity_id);
CREATE INDEX idx_approval_req_status ON approval_requests(status);
CREATE INDEX idx_approval_req_requested_by ON approval_requests(requested_by);

-- ========================
-- APPROVAL STEPS (Individual step records)
-- ========================
CREATE TABLE approval_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_order          INTEGER NOT NULL,
    approver_role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    approved_by         UUID REFERENCES user_profiles(id),
    status              approval_step_status NOT NULL DEFAULT 'pending',
    comments            TEXT,
    acted_at            TIMESTAMPTZ,

    CONSTRAINT uq_approval_step UNIQUE (request_id, step_order)
);

CREATE INDEX idx_approval_steps_request ON approval_steps(request_id);
CREATE INDEX idx_approval_steps_status ON approval_steps(status);

-- ============================================================
-- WORKFLOW HELPER: Create approval request from matrix
-- ============================================================
CREATE OR REPLACE FUNCTION create_approval_request(
    p_company_id UUID,
    p_branch_id UUID,
    p_entity_type approval_entity_type,
    p_entity_id UUID,
    p_amount NUMERIC(18,2),
    p_requested_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_total_steps INTEGER;
    v_matrix_row RECORD;
BEGIN
    -- Find applicable approval matrix entries
    -- Pick the set with the highest threshold that is <= p_amount
    -- (or threshold IS NULL which applies to all)

    -- Count steps
    SELECT COUNT(*) INTO v_total_steps
    FROM approval_matrix am
    WHERE am.company_id = p_company_id
      AND (am.branch_id = p_branch_id OR am.branch_id IS NULL)
      AND am.entity_type = p_entity_type
      AND am.is_active = TRUE
      AND (
          am.threshold_amount IS NULL
          OR (p_amount IS NOT NULL AND p_amount >= am.threshold_amount)
      );

    IF v_total_steps = 0 THEN
        RAISE EXCEPTION 'No approval matrix configured for entity_type % in company %',
            p_entity_type, p_company_id;
    END IF;

    -- Create the request
    INSERT INTO approval_requests (
        company_id, branch_id, entity_type, entity_id,
        total_steps, requested_by
    ) VALUES (
        p_company_id, p_branch_id, p_entity_type, p_entity_id,
        v_total_steps, p_requested_by
    ) RETURNING id INTO v_request_id;

    -- Create individual steps
    INSERT INTO approval_steps (request_id, step_order, approver_role_id)
    SELECT v_request_id, am.step_order, am.approver_role_id
    FROM approval_matrix am
    WHERE am.company_id = p_company_id
      AND (am.branch_id = p_branch_id OR am.branch_id IS NULL)
      AND am.entity_type = p_entity_type
      AND am.is_active = TRUE
      AND (
          am.threshold_amount IS NULL
          OR (p_amount IS NOT NULL AND p_amount >= am.threshold_amount)
      )
    ORDER BY am.step_order;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- WORKFLOW HELPER: Process an approval step
-- ============================================================
CREATE OR REPLACE FUNCTION process_approval_step(
    p_request_id UUID,
    p_user_id UUID,
    p_action approval_step_status,  -- 'approved' or 'rejected'
    p_comments TEXT DEFAULT NULL
)
RETURNS approval_requests AS $$
DECLARE
    v_request approval_requests%ROWTYPE;
    v_step approval_steps%ROWTYPE;
    v_user_role_ids UUID[];
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM approval_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Approval request % not found', p_request_id;
    END IF;

    IF v_request.status NOT IN ('pending', 'in_progress') THEN
        RAISE EXCEPTION 'Approval request % is already %',
            p_request_id, v_request.status;
    END IF;

    -- Get the current pending step
    SELECT * INTO v_step
    FROM approval_steps
    WHERE request_id = p_request_id
      AND step_order = v_request.current_step
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pending step found for request %', p_request_id;
    END IF;

    -- Verify user has the required role
    SELECT array_agg(role_id) INTO v_user_role_ids
    FROM user_assignments
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND group_id = (SELECT group_id FROM companies WHERE id = v_request.company_id)
      AND (company_id = v_request.company_id OR company_id IS NULL)
      AND (branch_id = v_request.branch_id OR branch_id IS NULL);

    IF NOT (v_step.approver_role_id = ANY(v_user_role_ids)) THEN
        RAISE EXCEPTION 'User % does not have the required role for this approval step',
            p_user_id;
    END IF;

    -- Update the step
    UPDATE approval_steps
    SET status = p_action,
        approved_by = p_user_id,
        comments = p_comments,
        acted_at = now()
    WHERE id = v_step.id;

    IF p_action = 'rejected' THEN
        -- Reject the entire request
        UPDATE approval_requests
        SET status = 'rejected',
            completed_at = now()
        WHERE id = p_request_id;
    ELSIF p_action = 'approved' THEN
        IF v_request.current_step >= v_request.total_steps THEN
            -- All steps done
            UPDATE approval_requests
            SET status = 'approved',
                completed_at = now()
            WHERE id = p_request_id;
        ELSE
            -- Advance to next step
            UPDATE approval_requests
            SET status = 'in_progress',
                current_step = current_step + 1
            WHERE id = p_request_id;
        END IF;
    END IF;

    -- Return updated request
    SELECT * INTO v_request FROM approval_requests WHERE id = p_request_id;
    RETURN v_request;
END;
$$ LANGUAGE plpgsql;
