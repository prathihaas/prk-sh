-- RPC function: get current balance for a list of cashbooks
-- Returns the latest day's system_closing (or opening_balance if no transactions)
-- Falls back to nothing if no days exist (caller uses cashbook.opening_balance)

CREATE OR REPLACE FUNCTION get_cashbook_current_balances(p_cashbook_ids UUID[])
RETURNS TABLE(cashbook_id UUID, current_balance NUMERIC(18,2), latest_day_date DATE)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT DISTINCT ON (cd.cashbook_id)
        cd.cashbook_id,
        COALESCE(cd.system_closing, cd.opening_balance) AS current_balance,
        cd.date AS latest_day_date
    FROM cashbook_days cd
    WHERE cd.cashbook_id = ANY(p_cashbook_ids)
    ORDER BY cd.cashbook_id, cd.date DESC;
$$;
