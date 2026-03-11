"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  cashbookSchema,
  type CashbookFormValues,
} from "@/lib/validators/cashbook";

/**
 * Get cashbooks for a company/branch.
 *
 * KEY RULES:
 * - BANK accounts (type="bank") are COMPANY-WIDE — no branch filter.
 *   All branches in the company share the same bank accounts.
 * - CASH/PETTY cashbooks (type="main"/"petty") are BRANCH-SPECIFIC.
 *   Apply branch filter for these.
 */
export async function getCashbooks(
  companyId: string,
  branchId?: string | null,
  typeFilter?: "cash" | "bank" | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("cashbooks")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  if (typeFilter === "bank") {
    // Banks are company-wide — DO NOT filter by branch
    query = query.eq("type", "bank");
  } else if (typeFilter === "cash") {
    // Cash/petty are branch-specific
    if (branchId) query = query.eq("branch_id", branchId);
    query = query.in("type", ["main", "petty"]);
  } else {
    // No type filter: apply branch filter for non-bank books
    if (branchId) query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get cashbooks with per-user access enforcement:
 *
 * - CASHIERS (hierarchy_level >= 5): see ONLY the single cashbook assigned to them
 *   in company_configs["cashier_cashbook_assignments"][userId].
 *   If no assignment, they see nothing (cannot operate without being assigned).
 *
 * - MANAGERS & ABOVE (hierarchy_level < 5): see ALL cashbooks for their scope.
 *
 * - BANK accounts: always company-wide, visible to everyone with CASHBOOK_READ.
 *   No cashier restriction on bank visibility (but they can't transact in banks
 *   if not assigned there).
 */
export async function getCashbooksForUser(
  companyId: string,
  branchId: string | null | undefined,
  userId: string,
  userHierarchyLevel: number,
  typeFilter?: "cash" | "bank" | null
) {
  const supabase = await createClient();

  // Banks are always company-wide — no per-user restriction on viewing
  if (typeFilter === "bank") {
    return getCashbooks(companyId, null, "bank");
  }

  // Cashier level: show only their assigned cashbook
  const isCashierLevel = userHierarchyLevel >= 5;
  if (isCashierLevel) {
    const { data: config } = await supabase
      .from("company_configs")
      .select("config_value")
      .eq("company_id", companyId)
      .eq("config_key", "cashier_cashbook_assignments")
      .single();

    let assignedCashbookId: string | null = null;
    if (config?.config_value) {
      try {
        const assignments: Record<string, string> =
          typeof config.config_value === "object"
            ? (config.config_value as Record<string, string>)
            : JSON.parse(String(config.config_value));
        assignedCashbookId = assignments[userId] || null;
      } catch {
        assignedCashbookId = null;
      }
    }

    if (!assignedCashbookId) {
      // No cashbook assigned to this cashier — return empty list
      return [];
    }

    // Return only the assigned cashbook (must belong to this company)
    const { data, error } = await supabase
      .from("cashbooks")
      .select("*")
      .eq("id", assignedCashbookId)
      .eq("company_id", companyId)
      .in("type", ["main", "petty"]);

    if (error) throw error;
    return data || [];
  }

  // Managers and above: standard full access
  return getCashbooks(companyId, branchId, typeFilter ?? "cash");
}

/**
 * Get active cashbooks (for dropdown in receipt/payment forms).
 * Filters to active only. Uses getCashbooksForUser so cashiers only see their book.
 */
export async function getActiveCashbooksForUser(
  companyId: string,
  branchId: string | null | undefined,
  userId: string,
  userHierarchyLevel: number
) {
  const cashbooks = await getCashbooksForUser(
    companyId,
    branchId,
    userId,
    userHierarchyLevel,
    "cash"
  );
  return cashbooks.filter((c: { is_active: boolean }) => c.is_active);
}

export async function openCashbookAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cashbooks")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cash/cashbooks");
  revalidatePath("/banks/accounts");
  return { success: true };
}

export async function closeCashbookAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cashbooks")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cash/cashbooks");
  revalidatePath("/banks/accounts");
  return { success: true };
}

export async function getCashbook(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashbooks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCashbook(
  values: CashbookFormValues & {
    company_id: string;
    branch_id: string;
    created_by: string;
  }
) {
  const validated = cashbookSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("cashbooks").insert({
    name: validated.name,
    type: validated.type,
    opening_balance: validated.opening_balance,
    is_active: validated.is_active,
    company_id: values.company_id,
    branch_id: values.branch_id,
    created_by: values.created_by,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A cashbook with this name already exists in this branch." };
    }
    return { error: error.message };
  }

  revalidatePath("/cash/cashbooks");
  return { success: true };
}

export async function updateCashbook(id: string, values: CashbookFormValues) {
  const validated = cashbookSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("cashbooks")
    .update({
      name: validated.name,
      type: validated.type,
      opening_balance: validated.opening_balance,
      is_active: validated.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A cashbook with this name already exists in this branch." };
    }
    return { error: error.message };
  }

  revalidatePath("/cash/cashbooks");
  return { success: true };
}
