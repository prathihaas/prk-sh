"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Roles that can approve any expense in their company, regardless of branch.
 * (Owners, group finance controllers, and company accountants get a company-wide view.)
 */
const ANY_BRANCH_ROLES = [
  "owner",
  "group_finance_controller",
  "company_accountant",
] as const;

export interface EligibleApprover {
  user_id: string;
  full_name: string | null;
  email: string | null;
  telegram_chat_id: string | null;
  role_name: string;
}

interface AssignmentRow {
  user_id: string;
  company_id: string | null;
  branch_id: string | null;
  user: {
    full_name: string | null;
    email: string | null;
    telegram_chat_id: string | null;
    is_active: boolean;
  } | null;
  role: { name: string } | null;
}

/**
 * Return every user who can approve an expense in (companyId, branchId).
 *
 * Eligibility:
 *   - role ∈ (owner, group_finance_controller, company_accountant) and assignment scope
 *     covers the company → eligible regardless of branch
 *   - role = branch_manager and assignment scope covers the company AND
 *     (branch_id is null wildcard OR branch_id matches the expense's branch) → eligible
 *
 * The same user is returned at most once, even if they have multiple matching assignments.
 */
export async function getEligibleExpenseApprovers(
  supabase: SupabaseClient,
  companyId: string,
  branchId: string | null
): Promise<EligibleApprover[]> {
  const { data, error } = await supabase
    .from("user_assignments")
    .select(
      `
      user_id,
      company_id,
      branch_id,
      user:user_profiles!user_assignments_user_id_fkey(full_name, email, telegram_chat_id, is_active),
      role:roles(name)
    `
    )
    .eq("is_active", true)
    .or(`company_id.is.null,company_id.eq.${companyId}`);

  if (error || !data) return [];

  const out: EligibleApprover[] = [];
  const seen = new Set<string>();

  for (const a of data as unknown as AssignmentRow[]) {
    const role = a.role?.name;
    const user = a.user;
    if (!role || !user || !user.is_active) continue;

    let isEligible = false;
    if ((ANY_BRANCH_ROLES as readonly string[]).includes(role)) {
      isEligible = true;
    } else if (role === "branch_manager") {
      // branch_id IS NULL means "all branches in this company" (rare wildcard)
      if (a.branch_id === null || a.branch_id === branchId) {
        isEligible = true;
      }
    }

    if (isEligible && !seen.has(a.user_id)) {
      seen.add(a.user_id);
      out.push({
        user_id: a.user_id,
        full_name: user.full_name,
        email: user.email,
        telegram_chat_id: user.telegram_chat_id,
        role_name: role,
      });
    }
  }

  return out;
}

export async function isUserEligibleExpenseApprover(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  branchId: string | null
): Promise<boolean> {
  const approvers = await getEligibleExpenseApprovers(supabase, companyId, branchId);
  return approvers.some((a) => a.user_id === userId);
}
