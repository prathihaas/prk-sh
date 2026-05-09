-- 054: RPC the async fraud-check worker calls per queue row.
-- Reproduces the same logic as the four legacy detect_* TRIGGER functions
-- but parameterised by transaction_id + kind so it can run outside the
-- INSERT trigger context.

CREATE OR REPLACE FUNCTION public.run_fraud_check(
  p_transaction_id uuid,
  p_kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t            cashbook_transactions%ROWTYPE;
  v_day_date   DATE;
  v_hour       INTEGER;
  v_start_hour INTEGER := 8;
  v_end_hour   INTEGER := 22;
  v_threshold  NUMERIC := 500000;
  v_config     JSONB;
  v_txn_count  INTEGER;
BEGIN
  SELECT * INTO t FROM cashbook_transactions WHERE id = p_transaction_id;
  IF NOT FOUND OR t.is_voided THEN RETURN; END IF;

  IF p_kind = 'backdated' THEN
    SELECT date INTO v_day_date FROM cashbook_days WHERE id = t.cashbook_day_id;
    IF v_day_date < (CURRENT_DATE - INTERVAL '1 day') THEN
      INSERT INTO fraud_flags (company_id, branch_id, flag_type, severity, table_name, record_id, flagged_by, description, metadata)
      VALUES (t.company_id, t.branch_id, 'backdated_entry', 'medium', 'cashbook_transactions', t.id, t.created_by,
        format('Transaction created for date %s (entry time: %s). Gap exceeds 1 day.', v_day_date, t.created_at),
        jsonb_build_object('day_date', v_day_date, 'entry_time', t.created_at, 'amount', t.amount, 'receipt_number', t.receipt_number));
    END IF;

  ELSIF p_kind = 'off_hours' THEN
    v_hour := EXTRACT(HOUR FROM t.created_at AT TIME ZONE 'Asia/Kolkata');
    SELECT config_value INTO v_config FROM company_configs WHERE company_id = t.company_id AND config_key = 'fraud_rules';
    IF v_config IS NOT NULL THEN
      v_start_hour := COALESCE((v_config ->> 'business_start_hour')::INTEGER, 8);
      v_end_hour   := COALESCE((v_config ->> 'business_end_hour')::INTEGER, 22);
    END IF;
    IF v_hour < v_start_hour OR v_hour >= v_end_hour THEN
      INSERT INTO fraud_flags (company_id, branch_id, flag_type, severity, table_name, record_id, flagged_by, description, metadata)
      VALUES (t.company_id, t.branch_id, 'off_hours_activity', 'low', 'cashbook_transactions', t.id, t.created_by,
        format('Transaction created at %s IST (outside business hours %s:00-%s:00).', (t.created_at AT TIME ZONE 'Asia/Kolkata')::TIME, v_start_hour, v_end_hour),
        jsonb_build_object('created_at_ist', t.created_at AT TIME ZONE 'Asia/Kolkata', 'hour', v_hour, 'business_start', v_start_hour, 'business_end', v_end_hour, 'amount', t.amount, 'receipt_number', t.receipt_number));
    END IF;

  ELSIF p_kind = 'rapid' THEN
    SELECT COUNT(*) INTO v_txn_count FROM cashbook_transactions
     WHERE created_by = t.created_by AND company_id = t.company_id
       AND created_at > (t.created_at - INTERVAL '30 minutes') AND id != t.id;
    IF v_txn_count >= 10 THEN
      INSERT INTO fraud_flags (company_id, branch_id, flag_type, severity, table_name, record_id, flagged_by, description, metadata)
      VALUES (t.company_id, t.branch_id, 'rapid_transactions', 'medium', 'cashbook_transactions', t.id, t.created_by,
        format('User created %s transactions in the last 30 minutes.', v_txn_count + 1),
        jsonb_build_object('txn_count_30min', v_txn_count + 1, 'user_id', t.created_by, 'latest_amount', t.amount, 'latest_receipt', t.receipt_number));
    END IF;

  ELSIF p_kind = 'threshold' THEN
    SELECT config_value INTO v_config FROM company_configs WHERE company_id = t.company_id AND config_key = 'fraud_rules';
    IF v_config IS NOT NULL THEN
      v_threshold := COALESCE((v_config ->> 'high_value_txn_threshold')::NUMERIC, 500000);
    END IF;
    IF t.amount >= v_threshold THEN
      INSERT INTO fraud_flags (company_id, branch_id, flag_type, severity, table_name, record_id, flagged_by, description, metadata)
      VALUES (t.company_id, t.branch_id, 'threshold_breach', 'medium', 'cashbook_transactions', t.id, t.created_by,
        format('High-value transaction of %s recorded (threshold: %s).', t.amount, v_threshold),
        jsonb_build_object('amount', t.amount, 'threshold', v_threshold, 'payment_mode', t.payment_mode, 'receipt_number', t.receipt_number, 'narration', t.narration));
    END IF;

  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_fraud_check(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_fraud_check(uuid, text) TO service_role;
