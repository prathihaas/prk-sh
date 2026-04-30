"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The DB schema uses: entity_type, entity_id, status (on approval_requests)
// and approved_by (on approval_steps). The UI was written against an older
// schema with different names — we alias on read to keep the UI unchanged.

const REQUEST_SELECT = `
  id,
  company_id,
  branch_id,
  current_step,
  total_steps,
  created_at,
  request_type:entity_type,
  reference_id:entity_id,
  overall_status:status,
  steps:approval_steps(
    id,
    request_id,
    step_order,
    approver_role_id,
    status,
    comments,
    acted_at,
    assigned_to:approved_by,
    approver:user_profiles!approval_steps_approved_by_fkey(full_name)
  )
`;

export async function getApprovalRequests(
  companyId: string,
  branchId?: string | null,
  filters?: { status?: string; type?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("approval_requests")
    .select(REQUEST_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.type) query = query.eq("entity_type", filters.type);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getApprovalRequest(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select(REQUEST_SELECT)
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
      approved_by: user.id,
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
      approved_by: user.id,
      comments,
      acted_at: new Date().toISOString(),
    })
    .eq("id", stepId)
    .eq("status", "pending");

  if (stepError) return { error: stepError.message };

  const { data: step } = await supabase
    .from("approval_steps")
    .select("request_id")
    .eq("id", stepId)
    .single();

  if (step) {
    await supabase
      .from("approval_requests")
      .update({ status: "rejected" })
      .eq("id", step.request_id);
  }

  revalidatePath("/approvals");
  return { success: true };
}
