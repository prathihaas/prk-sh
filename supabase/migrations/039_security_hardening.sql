-- Migration 039: Comprehensive Security Hardening
--
-- Fixes identified in the cybersecurity audit:
--
-- 1. CRITICAL: ALL public tables granted ALL privileges to `anon` role
--    Anyone with the public Supabase anon key could read/write ALL data.
--    Fix: Revoke everything from anon on all public tables, sequences, functions.
--
-- 2. CRITICAL: 24 audit_log partition tables had RLS DISABLED
--    Audit logs were completely exposed — no row-level filtering.
--    Fix: Enable RLS + FORCE on all partitions; add company-scoped read policy.
--
-- 3. HIGH: All public functions executable by anon via PUBLIC pseudo-role
--    Fix: Revoke EXECUTE from PUBLIC, grant only to authenticated.
--
-- 4. MEDIUM: System-only tables writable by authenticated role
--    audit_log, fraud_flags, transaction_revisions, receipt_number_series,
--    challan_number_series are written exclusively by SECURITY DEFINER triggers.
--    Fix: Revoke INSERT/UPDATE/DELETE from authenticated; keep SELECT only.
--
-- 5. PREVENTIVE: Set default privileges so future objects don't auto-grant to anon.
--
-- SAFETY: The webapp uses server-side authenticated Supabase client for all
-- operations. SECURITY DEFINER triggers bypass RLS and privilege checks.
-- The service_role (supabaseAdmin) also bypasses all restrictions.
-- No webapp functionality is affected by these changes.

BEGIN;

-- ============================================================
-- 1. REVOKE ALL from anon on ALL public tables
-- ============================================================
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl.tablename);
  END LOOP;
END;
$$;

-- ============================================================
-- 2. REVOKE ALL from anon on ALL public sequences
-- ============================================================
DO $$
DECLARE
  seq RECORD;
BEGIN
  FOR seq IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', seq.sequencename);
  END LOOP;
END;
$$;

-- ============================================================
-- 3. REVOKE EXECUTE from PUBLIC on all public functions, grant to authenticated
-- ============================================================
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', func.proname, func.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', func.proname, func.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', func.proname, func.args);
  END LOOP;
END;
$$;

-- ============================================================
-- 4. Enable RLS on all audit_log partitions + add company-scoped read policy
-- ============================================================
DO $$
DECLARE
  partition_name TEXT;
  y INT;
  m INT;
BEGIN
  FOR y IN 2025..2026 LOOP
    FOR m IN 1..12 LOOP
      partition_name := format('audit_log_%s_%s', y, lpad(m::text, 2, '0'));

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', partition_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', partition_name);

      -- Drop policy if it already exists (idempotent)
      EXECUTE format(
        'DROP POLICY IF EXISTS "auth_read_company_audit" ON public.%I',
        partition_name
      );

      EXECUTE format(
        'CREATE POLICY "auth_read_company_audit" ON public.%I
         FOR SELECT TO authenticated
         USING (company_id = ANY(get_user_accessible_companies(auth.uid())))',
        partition_name
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- 5. Restrict authenticated role on system-only tables (SELECT only)
-- ============================================================

-- audit_log (parent partitioned table)
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;

-- audit_log partitions
DO $$
DECLARE
  y INT; m INT; pname TEXT;
BEGIN
  FOR y IN 2025..2026 LOOP
    FOR m IN 1..12 LOOP
      pname := format('audit_log_%s_%s', y, lpad(m::text, 2, '0'));
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', pname);
    END LOOP;
  END LOOP;
END;
$$;

-- fraud_flags — written by detect_* SECURITY DEFINER triggers only
REVOKE INSERT, UPDATE, DELETE ON public.fraud_flags FROM authenticated;

-- transaction_revisions — written by audit triggers only
REVOKE INSERT, UPDATE, DELETE ON public.transaction_revisions FROM authenticated;

-- receipt_number_series — managed by generate_receipt_number_and_hash trigger
REVOKE INSERT, UPDATE, DELETE ON public.receipt_number_series FROM authenticated;

-- challan_number_series — managed by generate_challan_number trigger
REVOKE INSERT, UPDATE, DELETE ON public.challan_number_series FROM authenticated;

-- ============================================================
-- 6. Set default privileges for future objects
-- ============================================================

-- Future tables: no access for anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Future functions: no access for anon or PUBLIC; grant to authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Future sequences: no access for anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

COMMIT;
