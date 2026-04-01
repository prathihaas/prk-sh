-- ============================================================
-- Migration 006: Custom Field Engine
-- ============================================================

-- ========================
-- CUSTOM FIELD DEFINITIONS
-- ========================
CREATE TABLE custom_field_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    entity_type     custom_field_entity NOT NULL,
    field_name      TEXT NOT NULL,
    field_label     TEXT NOT NULL,
    field_type      custom_field_type NOT NULL,
    dropdown_options JSONB,          -- ["Option A", "Option B"]
    is_mandatory    BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_custom_field_def UNIQUE (company_id, entity_type, field_name),
    -- Dropdown must have options
    CONSTRAINT chk_dropdown_options CHECK (
        field_type != 'dropdown'
        OR (dropdown_options IS NOT NULL AND jsonb_array_length(dropdown_options) > 0)
    )
);

CREATE INDEX idx_cfd_company ON custom_field_definitions(company_id);
CREATE INDEX idx_cfd_entity_type ON custom_field_definitions(entity_type);

-- ========================
-- CUSTOM FIELD VALUES
-- ========================
-- Uses typed columns for type-safe storage.
-- Only the column matching field_type should be populated.
-- ========================
CREATE TABLE custom_field_values (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id        UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE RESTRICT,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    entity_type     custom_field_entity NOT NULL,
    entity_id       UUID NOT NULL,
    value_text      TEXT,
    value_numeric   NUMERIC(18,4),
    value_date      DATE,
    value_boolean   BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_custom_field_value UNIQUE (field_id, entity_id)
);

CREATE INDEX idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX idx_cfv_field ON custom_field_values(field_id);
CREATE INDEX idx_cfv_company ON custom_field_values(company_id);

CREATE TRIGGER trg_cfv_updated_at
    BEFORE UPDATE ON custom_field_values
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Validation trigger: ensure the correct typed column is used
-- ============================================================
CREATE OR REPLACE FUNCTION validate_custom_field_value()
RETURNS TRIGGER AS $$
DECLARE
    v_field_type custom_field_type;
    v_is_mandatory BOOLEAN;
    v_entity_type custom_field_entity;
BEGIN
    SELECT field_type, is_mandatory, entity_type
    INTO v_field_type, v_is_mandatory, v_entity_type
    FROM custom_field_definitions
    WHERE id = NEW.field_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Custom field definition % not found', NEW.field_id;
    END IF;

    -- Verify entity_type matches
    IF NEW.entity_type != v_entity_type THEN
        RAISE EXCEPTION 'Entity type mismatch: field expects %, got %',
            v_entity_type, NEW.entity_type;
    END IF;

    -- Validate correct column populated based on type
    CASE v_field_type
        WHEN 'text' THEN
            IF v_is_mandatory AND (NEW.value_text IS NULL OR NEW.value_text = '') THEN
                RAISE EXCEPTION 'Mandatory text field % cannot be empty', NEW.field_id;
            END IF;
        WHEN 'number' THEN
            IF v_is_mandatory AND NEW.value_numeric IS NULL THEN
                RAISE EXCEPTION 'Mandatory number field % cannot be null', NEW.field_id;
            END IF;
        WHEN 'date' THEN
            IF v_is_mandatory AND NEW.value_date IS NULL THEN
                RAISE EXCEPTION 'Mandatory date field % cannot be null', NEW.field_id;
            END IF;
        WHEN 'boolean' THEN
            IF v_is_mandatory AND NEW.value_boolean IS NULL THEN
                RAISE EXCEPTION 'Mandatory boolean field % cannot be null', NEW.field_id;
            END IF;
        WHEN 'dropdown' THEN
            IF v_is_mandatory AND (NEW.value_text IS NULL OR NEW.value_text = '') THEN
                RAISE EXCEPTION 'Mandatory dropdown field % cannot be empty', NEW.field_id;
            END IF;
            -- Validate dropdown value exists in options
            IF NEW.value_text IS NOT NULL THEN
                DECLARE
                    v_options JSONB;
                BEGIN
                    SELECT dropdown_options INTO v_options
                    FROM custom_field_definitions
                    WHERE id = NEW.field_id;

                    IF NOT v_options ? NEW.value_text THEN
                        RAISE EXCEPTION 'Value "%" not in allowed options for field %',
                            NEW.value_text, NEW.field_id;
                    END IF;
                END;
            END IF;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_custom_field_value
    BEFORE INSERT OR UPDATE ON custom_field_values
    FOR EACH ROW EXECUTE FUNCTION validate_custom_field_value();

-- ============================================================
-- Helper: Check mandatory custom fields before entity save
-- Called from application layer or via RPC
-- ============================================================
CREATE OR REPLACE FUNCTION check_mandatory_custom_fields(
    p_company_id UUID,
    p_entity_type custom_field_entity,
    p_entity_id UUID
)
RETURNS TABLE(field_name TEXT, field_label TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT cfd.field_name, cfd.field_label
    FROM custom_field_definitions cfd
    WHERE cfd.company_id = p_company_id
      AND cfd.entity_type = p_entity_type
      AND cfd.is_mandatory = TRUE
      AND cfd.is_active = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM custom_field_values cfv
          WHERE cfv.field_id = cfd.id
            AND cfv.entity_id = p_entity_id
      );
END;
$$ LANGUAGE plpgsql STABLE;
