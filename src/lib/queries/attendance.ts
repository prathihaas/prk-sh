"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getAttendancePeriods(companyId: string, branchId?: string | null) {
  const supabase = await createClient();
  let query = supabase.from("attendance_periods").select("*").eq("company_id", companyId)
    .order("year", { ascending: false }).order("month", { ascending: false });
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAttendancePeriod(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("attendance_periods").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createAttendancePeriod(values: { month: number; year: number; company_id: string; branch_id: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_periods").insert({ ...values, status: "open" });
  if (error) {
    if (error.code === "23505") return { error: "Period already exists for this month." };
    return { error: error.message };
  }
  revalidatePath("/hr/attendance");
  return { success: true };
}

export async function closeAttendancePeriod(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_periods").update({ status: "closed" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hr/attendance");
  return { success: true };
}

export async function approveAttendancePeriod(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_periods").update({ status: "approved" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hr/attendance");
  return { success: true };
}

export async function getAttendanceRecords(periodId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("attendance_records")
    .select("*, employee:employees(id, employee_code, full_name)")
    .eq("period_id", periodId).order("date");
  if (error) throw error;
  return data || [];
}

export async function markAttendance(values: { period_id: string; employee_id: string; date: string; status: string }) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("attendance_records").select("id")
    .eq("period_id", values.period_id).eq("employee_id", values.employee_id).eq("date", values.date).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("attendance_records").update({ status: values.status }).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("attendance_records").insert(values);
    if (error) return { error: error.message };
  }
  revalidatePath("/hr/attendance");
  return { success: true };
}
