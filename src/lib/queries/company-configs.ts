"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getCompanyConfigs(
  companyId: string
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_configs")
    .select("config_key, config_value")
    .eq("company_id", companyId);

  if (error) throw error;

  const configs: Record<string, unknown> = {};
  for (const row of data || []) {
    configs[row.config_key] = row.config_value;
  }
  return configs;
}

export async function updateConfig(
  companyId: string,
  key: string,
  value: unknown
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("company_configs")
    .upsert(
      {
        company_id: companyId,
        config_key: key,
        config_value: value,
      },
      { onConflict: "company_id,config_key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

// ── Cash Limit helpers (Indian Law compliance) ─────────────────────────────

export interface CashLimits {
  /** Max cumulative cash received from a single customer per financial year (Section 269ST) */
  customer_cash_per_fy: number;
  /** Max cash per single expense payment (Section 40A(3)) */
  expense_cash_per_payment: number;
}

const DEFAULT_CASH_LIMITS: CashLimits = {
  customer_cash_per_fy: 200000,    // ₹2,00,000
  expense_cash_per_payment: 10000, // ₹10,000
};

export async function getCashLimits(companyId: string): Promise<CashLimits> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "cash_limits")
    .single();

  if (!data?.config_value) return { ...DEFAULT_CASH_LIMITS };

  const stored = data.config_value as Partial<CashLimits>;
  return {
    customer_cash_per_fy: stored.customer_cash_per_fy ?? DEFAULT_CASH_LIMITS.customer_cash_per_fy,
    expense_cash_per_payment: stored.expense_cash_per_payment ?? DEFAULT_CASH_LIMITS.expense_cash_per_payment,
  };
}

export async function updateCashLimits(companyId: string, limits: CashLimits) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "cash_limits", config_value: limits },
      { onConflict: "company_id,config_key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
