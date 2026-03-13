"use server";

import { createClient } from "@/lib/supabase/server";

interface DateRange {
  dateFrom?: string | null;
  dateTo?: string | null;
}

export async function getCashSummary(
  companyId: string,
  branchId?: string | null,
  { dateFrom, dateTo }: DateRange = {}
) {
  const supabase = await createClient();

  let query = supabase
    .from("cashbook_days")
    .select(
      "id, date, opening_balance, system_closing, status, cashbook:cashbooks(name)"
    )
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .limit(200);

  if (branchId) query = query.eq("branch_id", branchId);
  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);

  const { data: days, error: daysError } = await query;
  if (daysError) throw daysError;
  if (!days || days.length === 0) return [];

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
  branchId?: string | null,
  { dateFrom, dateTo }: DateRange = {}
) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, dms_invoice_number, customer_name, grand_total, balance_due, approval_status, invoice_date, invoice_type"
    )
    .eq("company_id", companyId)
    .eq("is_cancelled", false)
    .order("invoice_date", { ascending: false })
    .limit(500);

  if (branchId) query = query.eq("branch_id", branchId);
  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices = (data || []) as any[];
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
  const totalCollected = totalRevenue - totalOutstanding;

  return {
    invoices,
    summary: { totalRevenue, totalOutstanding, totalCollected, count: invoices.length },
  };
}

export async function getExpenseSummary(
  companyId: string,
  branchId?: string | null,
  { dateFrom, dateTo }: DateRange = {}
) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(
      "id, amount, approval_status, expense_date, category:expense_categories(name)"
    )
    .eq("company_id", companyId)
    .order("expense_date", { ascending: false })
    .limit(500);

  if (branchId) query = query.eq("branch_id", branchId);
  if (dateFrom) query = query.gte("expense_date", dateFrom);
  if (dateTo) query = query.lte("expense_date", dateTo);

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenses = (data || []) as any[];
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const approvedExpenses = expenses
    .filter((e) => e.approval_status === "owner_approved")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingExpenses = expenses
    .filter((e) => !["owner_approved", "rejected"].includes(e.approval_status))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  return {
    expenses,
    summary: { totalExpenses, approvedExpenses, pendingExpenses, count: expenses.length },
  };
}

export async function getPayrollSummary(
  companyId: string,
  branchId?: string | null,
  { dateFrom, dateTo }: DateRange = {}
) {
  const supabase = await createClient();
  let query = supabase
    .from("payroll_runs")
    .select("id, month, year, total_gross, total_deductions, total_net, status")
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(60);

  if (branchId) query = query.eq("branch_id", branchId);
  // Filter payroll by year/month using date range on a synthetic date
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
