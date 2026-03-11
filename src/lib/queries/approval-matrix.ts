"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  approvalMatrixSchema,
  type ApprovalMatrixFormValues,
} from "@/lib/validators/approval-matrix";

export async function getApprovalMatrix(
  companyId: string,
  requestType?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("approval_matrix")
    .select("*, approver_role:roles(id, name)")
    .eq("company_id", companyId)
    .order("request_type")
    .order("step_order");

  if (requestType) query = query.eq("request_type", requestType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getApprovalMatrixEntry(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_matrix")
    .select("*, approver_role:roles(id, name)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createApprovalMatrixEntry(
  values: ApprovalMatrixFormValues & { company_id: string }
) {
  const validated = approvalMatrixSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("approval_matrix").insert({
    company_id: values.company_id,
    request_type: validated.request_type,
    step_order: validated.step_order,
    approver_role_id: validated.approver_role_id,
    is_active: validated.is_active,
  });

  if (error) return { error: error.message };
  revalidatePath("/settings/approval-matrix");
  return { success: true };
}

export async function updateApprovalMatrixEntry(
  id: string,
  values: ApprovalMatrixFormValues
) {
  const validated = approvalMatrixSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("approval_matrix")
    .update({
      request_type: validated.request_type,
      step_order: validated.step_order,
      approver_role_id: validated.approver_role_id,
      is_active: validated.is_active,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/settings/approval-matrix");
  return { success: true };
}

export async function deleteApprovalMatrixEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("approval_matrix")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/settings/approval-matrix");
  return { success: true };
}
