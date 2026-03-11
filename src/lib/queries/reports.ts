"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCashSummary(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();

  // Get recent cashbook day summaries
  let query = supabase
    .from("cashbook_days")
    .select(
      "day_date, opening_balance, closing_balance, total_receipts, total_payments, status, cashbook:cashbooks(name)"
    )
    .eq("company_id", companyId)
    .order("day_date", { ascending: false })
    .limit(50);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  let query = supabase
    .from("payroll_runs")
    .select(
      "id, month, year, total_gross, total_deductions, total_net, status, employee_count"
    )
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
