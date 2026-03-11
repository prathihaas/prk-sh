"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getLeaveBalances(employeeId: string, financialYearId?: string) {
  const supabase = await createClient();
  let query = supabase.from("leave_balances").select("*").eq("employee_id", employeeId).order("leave_type");
  if (financialYearId) query = query.eq("financial_year_id", financialYearId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertLeaveBalance(values: { employee_id: string; financial_year_id: string; leave_type: string; total_days: number; used_days: number }) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("leave_balances").select("id")
    .eq("employee_id", values.employee_id).eq("financial_year_id", values.financial_year_id).eq("leave_type", values.leave_type).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("leave_balances").update({ total_days: values.total_days, used_days: values.used_days }).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("leave_balances").insert(values);
    if (error) return { error: error.message };
  }
  revalidatePath("/hr/employees");
  return { success: true };
}
