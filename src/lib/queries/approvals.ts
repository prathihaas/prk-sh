"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getApprovalRequests(
  companyId: string,
  branchId?: string | null,
  filters?: { status?: string; type?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("approval_requests")
    .select("*, steps:approval_steps(*, approver:user_profiles(full_name))")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.status) query = query.eq("overall_status", filters.status);
  if (filters?.type) query = query.eq("request_type", filters.type);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getApprovalRequest(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*, steps:approval_steps(*, approver:user_profiles(full_name))")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function approveStep(stepId: string, comments?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("approval_steps")
    .update({
      status: "approved",
      assigned_to: user.id,
      comments: comments || null,
      acted_at: new Date().toISOString(),
    })
    .eq("id", stepId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/approvals");
  return { success: true };
}

export async function rejectStep(stepId: string, comments: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: stepError } = await supabase
    .from("approval_steps")
    .update({
      status: "rejected",
      assigned_to: user.id,
      comments,
      acted_at: new Date().toISOString(),
    })
    .eq("id", stepId)
    .eq("status", "pending");

  if (stepError) return { error: stepError.message };

  // Also update the overall request status
  const { data: step } = await supabase
    .from("approval_steps")
    .select("request_id")
    .eq("id", stepId)
    .single();

  if (step) {
    await supabase
      .from("approval_requests")
      .update({ overall_status: "rejected" })
      .eq("id", step.request_id);
  }

  revalidatePath("/approvals");
  return { success: true };
}
