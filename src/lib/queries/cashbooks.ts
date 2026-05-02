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

  if (typeFilter === "bank") {
    // Banks are company-wide — DO NOT filter by branch
    const { data, error } = await supabase
      .from("cashbooks")
      .select("*")
      .eq("company_id", companyId)
      .eq("type", "bank")
      .order("name");
    if (error) throw error;
    return data || [];
  }

  if (typeFilter === "cash") {
    // Cash/petty are branch-specific
    let q = supabase
      .from("cashbooks")
      .select("*")
      .eq("company_id", companyId)
      .in("type", ["main", "petty"]);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q.order("name");
    if (error) throw error;
    return data || [];
  }

  // No type filter: return ALL types (cash + bank).
  // Use two separate queries to avoid PostgREST .or() issues:
  //   1. Cash/petty for this branch (branch-specific)
  //   2. Bank accounts (always company-wide, no branch filter)
  if (branchId) {
    const [cashResult, bankResult] = await Promise.all([
      supabase
        .from("cashbooks")
        .select("*")
        .eq("company_id", companyId)
        .eq("branch_id", branchId)
        .in("type", ["main", "petty"])
        .order("name"),
      supabase
        .from("cashbooks")
        .select("*")
        .eq("company_id", companyId)
        .eq("type", "bank")
        .order("name"),
    ]);
    if (cashResult.error) throw cashResult.error;
    if (bankResult.error) throw bankResult.error;
    return [...(cashResult.data || []), ...(bankResult.data || [])];
  }

  // No branchId: return all cashbooks for the company
  const { data, error } = await supabase
    .from("cashbooks")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

/**
 * Parse the stored cashier-cashbook assignment config into a uniform
 * `{ userId: cashbookId[] }` shape. Accepts the legacy
 * `{ userId: cashbookId }` form (single id) and the new `{ userId: string[] }`
 * form (multiple ids), so existing data keeps working.
 */
export function parseCashierCashbookAssignments(
  raw: unknown
): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[userId] = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    } else if (typeof value === "string" && value.length > 0) {
      out[userId] = [value];
    }
  }
  return out;
}

/**
 * Get cashbooks with per-user access enforcement:
 *
 * - CASHIERS (hierarchy_level >= 5): see only the cashbooks assigned to them
 *   in company_configs["cashier_cashbook_assignments"][userId]. The map can
 *   hold multiple cashbook ids per cashier (a string[] value).
 *   If no assignment, they see nothing.
 *
 * - MANAGERS & ABOVE (hierarchy_level < 5): see ALL cashbooks for their scope.
 *
 * - BANK accounts: always company-wide, visible to everyone with CASHBOOK_READ.
 */
export async function getCashbooksForUser(
  companyId: string,
  branchId: string | null | undefined,
  userId: string,
  userHierarchyLevel: number,
  typeFilter?: "cash" | "bank" | null
) {
  const supabase = await createClient();

  if (typeFilter === "bank") {
    return getCashbooks(companyId, null, "bank");
  }

  const isCashierLevel = userHierarchyLevel >= 5;
  if (isCashierLevel) {
    const { data: config } = await supabase
      .from("company_configs")
      .select("config_value")
      .eq("company_id", companyId)
      .eq("config_key", "cashier_cashbook_assignments")
      .single();

    const assignments = parseCashierCashbookAssignments(config?.config_value);
    const assignedIds = assignments[userId] ?? [];

    if (assignedIds.length === 0) return [];

    const { data, error } = await supabase
      .from("cashbooks")
      .select("*")
      .in("id", assignedIds)
      .eq("company_id", companyId)
      .in("type", ["main", "petty"]);

    if (error) throw error;
    return data || [];
  }

  return getCashbooks(companyId, branchId, typeFilter ?? null);
}

/**
 * Enrich cashbook rows with current_balance from the latest cashbook_day.
 * Falls back to opening_balance if no days exist.
 */
export async function enrichWithCurrentBalance<
  T extends { id: string; opening_balance: number }
>(cashbooks: T[]): Promise<(T & { current_balance: number })[]> {
  if (cashbooks.length === 0) return [];
  const supabase = await createClient();
  const ids = cashbooks.map((c) => c.id);
  const { data } = await supabase.rpc("get_cashbook_current_balances", {
    p_cashbook_ids: ids,
  });
  const balanceMap = new Map<string, number>();
  for (const row of data || []) {
    balanceMap.set(row.cashbook_id, Number(row.current_balance));
  }
  return cashbooks.map((c) => ({
    ...c,
    current_balance: balanceMap.get(c.id) ?? Number(c.opening_balance),
  }));
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
  // Pass null typeFilter so ALL cashbook types (cash + bank) are returned.
  // Banks are company-wide; cash/petty are branch-specific.
  // Cashiers will still only see their single assigned cashbook (enforced inside getCashbooksForUser).
  const cashbooks = await getCashbooksForUser(
    companyId,
    branchId,
    userId,
    userHierarchyLevel,
    null
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
