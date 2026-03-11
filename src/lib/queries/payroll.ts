"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getPayrollRuns(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("payroll_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPayrollRun(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPayrollRun(values: {
  month: number;
  year: number;
  company_id: string;
  branch_id: string;
  created_by: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_runs")
    .insert({ ...values, status: "draft" });
  if (error) {
    if (error.code === "23505")
      return { error: "A payroll run for this period already exists." };
    return { error: error.message };
  }
  revalidatePath("/hr/payroll");
  return { success: true };
}

export async function processPayroll(runId: string, totalWorkingDays: number) {
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (!run) return { error: "Run not found" };

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", run.company_id)
    .eq("branch_id", run.branch_id)
    .eq("status", "active");
  if (!employees || employees.length === 0)
    return { error: "No active employees found" };

  const { data: period } = await supabase
    .from("attendance_periods")
    .select("id")
    .eq("company_id", run.company_id)
    .eq("branch_id", run.branch_id)
    .eq("month", run.month)
    .eq("year", run.year)
    .maybeSingle();

  for (const emp of employees) {
    let daysWorked = totalWorkingDays;
    if (period) {
      const { data: records } = await supabase
        .from("attendance_records")
        .select("status")
        .eq("period_id", period.id)
        .eq("employee_id", emp.id);
      if (records && records.length > 0) {
        const absent = records.filter(
          (r: { status: string }) => r.status === "absent"
        ).length;
        const halfDay = records.filter(
          (r: { status: string }) => r.status === "half_day"
        ).length;
        daysWorked = totalWorkingDays - absent - halfDay * 0.5;
      }
    }
    const dailyRate =
      (emp.basic_salary + emp.hra + emp.allowances) / totalWorkingDays;
    const grossEarnings = dailyRate * daysWorked;
    const pfDed = emp.pf_applicable
      ? Math.min(emp.basic_salary * 0.12, 1800)
      : 0;
    const esiDed = emp.esi_applicable ? grossEarnings * 0.0075 : 0;
    const ptDed = emp.pt_applicable ? 200 : 0;
    const totalDed = pfDed + esiDed + ptDed;

    const entryData = {
      payroll_run_id: runId,
      employee_id: emp.id,
      days_worked: daysWorked,
      total_working_days: totalWorkingDays,
      basic_earned: (emp.basic_salary / totalWorkingDays) * daysWorked,
      hra_earned: (emp.hra / totalWorkingDays) * daysWorked,
      allowances_earned: (emp.allowances / totalWorkingDays) * daysWorked,
      gross_earnings: grossEarnings,
      pf_deduction: pfDed,
      esi_deduction: esiDed,
      pt_deduction: ptDed,
      total_deductions: totalDed,
      net_salary: grossEarnings - totalDed,
    };

    const { data: existing } = await supabase
      .from("payroll_entries")
      .select("id")
      .eq("payroll_run_id", runId)
      .eq("employee_id", emp.id)
      .maybeSingle();
    if (existing)
      await supabase
        .from("payroll_entries")
        .update(entryData)
        .eq("id", existing.id);
    else await supabase.from("payroll_entries").insert(entryData);
  }

  const { data: entries } = await supabase
    .from("payroll_entries")
    .select("gross_earnings, total_deductions, net_salary")
    .eq("payroll_run_id", runId);
  const tG =
    entries?.reduce(
      (s: number, e: { gross_earnings: number }) => s + e.gross_earnings,
      0
    ) || 0;
  const tD =
    entries?.reduce(
      (s: number, e: { total_deductions: number }) => s + e.total_deductions,
      0
    ) || 0;
  const tN =
    entries?.reduce(
      (s: number, e: { net_salary: number }) => s + e.net_salary,
      0
    ) || 0;

  await supabase
    .from("payroll_runs")
    .update({
      status: "processed",
      total_gross: tG,
      total_deductions: tD,
      total_net: tN,
      total_working_days: totalWorkingDays,
    })
    .eq("id", runId);
  revalidatePath("/hr/payroll");
  return { success: true };
}

export async function lockPayrollRun(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_runs")
    .update({ status: "locked" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hr/payroll");
  return { success: true };
}

export async function reopenPayrollRun(id: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_runs")
    .update({ status: "draft", reopen_reason: reason })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hr/payroll");
  return { success: true };
}

export async function getPayrollEntries(runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_entries")
    .select("*, employee:employees(employee_code, full_name)")
    .eq("payroll_run_id", runId)
    .order("employee_id");
  if (error) throw error;
  return data || [];
}
