"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getFraudFlags(
  companyId: string,
  filters?: { severity?: string; status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("fraud_flags")
    .select("*, flagged_by_user:user_profiles!fraud_flags_flagged_by_fkey(full_name)")
    .eq("company_id", companyId)
    .order("flagged_at", { ascending: false });

  if (filters?.severity) query = query.eq("severity", filters.severity);
  if (filters?.status) query = query.eq("resolution_status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getFraudFlag(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fraud_flags")
    .select("*, flagged_by_user:user_profiles!fraud_flags_flagged_by_fkey(full_name), resolved_by_user:user_profiles!fraud_flags_resolved_by_fkey(full_name)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function resolveFraudFlag(
  id: string,
  status: "resolved" | "false_positive",
  notes: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("fraud_flags")
    .update({
      resolution_status: status,
      resolved_by: user.id,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/audit/fraud-flags");
  return { success: true };
}
