"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCashSummary(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();

  // cashbook_days has: id, date, opening_balance, system_closing, status
  // (no day_date, closing_balance, total_receipts, or total_payments columns)
  let query = supabase
    .from("cashbook_days")
    .select(
      "id, date, opening_balance, system_closing, status, cashbook:cashbooks(name)"
    )
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .limit(50);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data: days, error: daysError } = await query;
  if (daysError) throw daysError;
  if (!days || days.length === 0) return [];

  // Aggregate receipt/payment totals from cashbook_transactions (txn_type: receipt | payment)
  const dayIds = days.map((d: { id: string }) => d.id);
  const { data: txns, error: txnError } = await supabase
    .from("cashbook_transactions")
    .select("cashbook_day_id, txn_type, amount")
    .in("cashbook_day_id", dayIds)
    .eq("is_voided", false);

  if (txnError) throw txnError;

  const aggregates = new Map<string, { total_receipts: number; total_payments: number }>();
  for (const txn of txns || []) {
    const agg = aggregates.get(txn.cashbook_day_id) || {
      total_receipts: 0,
      total_payments: 0,
    };
    if (txn.txn_type === "receipt") agg.total_receipts += Number(txn.amount) || 0;
    else if (txn.txn_type === "payment") agg.total_payments += Number(txn.amount) || 0;
    aggregates.set(txn.cashbook_day_id, agg);
  }

  // Return with aliased fields for UI compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (days as any[]).map((day) => ({
    ...day,
    day_date: day.date,
    closing_balance: day.system_closing,
    total_receipts: aggregates.get(day.id)?.total_receipts ?? 0,
    total_payments: aggregates.get(day.id)?.total_payments ?? 0,
  }));
}

export async function getRevenueSummary(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, customer_name, total_amount, balance_due, status, invoice_date"
    )
    .eq("company_id", companyId)
    .order("invoice_date", { ascending: false })
    .limit(100);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;

  const totalRevenue = (data || []).reduce(
    (sum: number, inv: any) => sum + (inv.total_amount || 0),
    0
  );
  const totalOutstanding = (data || []).reduce(
    (sum: number, inv: any) => sum + (inv.balance_due || 0),
    0
  );
  const totalCollected = totalRevenue - totalOutstanding;

  return {
    invoices: data || [],
    summary: {
      totalRevenue,
      totalOutstanding,
      totalCollected,
      count: (data || []).length,
    },
  };
}

export async function getExpenseSummary(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(
      "id, amount, approval_status, expense_date, category:expense_categories(name)"
    )
    .eq("company_id", companyId)
    .order("expense_date", { ascending: false })
    .limit(200);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;

  const expenses = data || [];
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const approvedExpenses = expenses
    .filter((e: any) => e.approval_status === "owner_approved")
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const pendingExpenses = expenses
    .filter(
      (e: any) => !["owner_approved", "rejected"].includes(e.approval_status)
    )
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  return {
    expenses,
    summary: {
      totalExpenses,
      approvedExpenses,
      pendingExpenses,
      count: expenses.length,
    },
  };
}

export async function getPayrollSummary(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();
  // payroll_runs has no employee_count column — removed from select
  let query = supabase
    .from("payroll_runs")
    .select("id, month, year, total_gross, total_deductions, total_net, status")
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
