"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { financialYearSchema, type FinancialYearFormValues } from "@/lib/validators/financial-year";

/**
 * Get the current active financial year for a company.
 * Prefers the FY whose date range covers today; falls back to the most recent active FY.
 * Returns null if no active FY exists.
 */
export async function getCurrentFinancialYear(companyId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Try to find the FY that covers today
  const { data: covering } = await supabase
    .from("financial_years")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1)
    .maybeSingle();

  if (covering) return covering;

  // Fallback: most recent active FY by start_date
  const { data: latest } = await supabase
    .from("financial_years")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest;
}

export async function getFinancialYears(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_years")
    .select("*, locked_by_user:user_profiles!fk_fy_locked_by(full_name)")
    .eq("company_id", companyId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFinancialYear(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_years")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createFinancialYear(
  values: FinancialYearFormValues & { company_id: string }
) {
  const validated = financialYearSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("financial_years").insert({
    company_id: values.company_id,
    label: validated.label,
    start_date: validated.start_date,
    end_date: validated.end_date,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A financial year with this label already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/org/financial-years");
  return { success: true };
}

export async function toggleFinancialYearLock(id: string, lock: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("financial_years")
    .update({
      is_locked: lock,
      locked_by: lock ? user?.id : null,
      locked_at: lock ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org/financial-years");
  return { success: true };
}
