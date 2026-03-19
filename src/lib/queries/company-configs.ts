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

// ── Insurance & Finance company name lists ─────────────────────────────────

export async function getInsuranceCompanies(companyId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "insurance_companies")
    .single();

  if (!data?.config_value) return [];
  const val = data.config_value;
  return Array.isArray(val) ? (val as string[]) : [];
}

export async function updateInsuranceCompanies(
  companyId: string,
  companies: string[]
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "insurance_companies", config_value: companies },
      { onConflict: "company_id,config_key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/settings/company-partners");
  return { success: true };
}

export async function getFinanceCompanies(companyId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "finance_companies")
    .single();

  if (!data?.config_value) return [];
  const val = data.config_value;
  return Array.isArray(val) ? (val as string[]) : [];
}

export async function updateFinanceCompanies(
  companyId: string,
  companies: string[]
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "finance_companies", config_value: companies },
      { onConflict: "company_id,config_key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/settings/company-partners");
  return { success: true };
}

// ── Denomination counting for cashbook day close ────────────────────────────

interface DenominationConfig {
  enabled: boolean;
  branch_overrides: Record<string, boolean>;
  cashbook_overrides: Record<string, boolean>;
}

function parseDenomConfig(raw: unknown): DenominationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    // Legacy: stored as plain boolean
    return { enabled: raw === true, branch_overrides: {}, cashbook_overrides: {} };
  }
  const obj = raw as Record<string, unknown>;
  return {
    enabled: obj.enabled === true,
    branch_overrides: (obj.branch_overrides as Record<string, boolean>) || {},
    cashbook_overrides: (obj.cashbook_overrides as Record<string, boolean>) || {},
  };
}

export async function getDenominationConfig(companyId: string): Promise<DenominationConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "denomination_required")
    .single();

  return parseDenomConfig(data?.config_value);
}

/**
 * Resolve whether denomination counting is required for a specific cashbook day.
 * Hierarchy: cashbook override → branch override → company setting
 */
export async function getDenominationSetting(
  companyId: string,
  branchId?: string | null,
  cashbookId?: string | null
): Promise<boolean> {
  const config = await getDenominationConfig(companyId);

  if (cashbookId && cashbookId in config.cashbook_overrides) {
    return config.cashbook_overrides[cashbookId];
  }
  if (branchId && branchId in config.branch_overrides) {
    return config.branch_overrides[branchId];
  }
  return config.enabled;
}

async function saveDenomConfig(companyId: string, config: DenominationConfig) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "denomination_required", config_value: config },
      { onConflict: "company_id,config_key" }
    );
  if (error) return { error: error.message };
  revalidatePath("/settings/denomination");
  return { success: true };
}

export async function updateDenominationCompanySetting(
  companyId: string,
  enabled: boolean
) {
  const config = await getDenominationConfig(companyId);
  return saveDenomConfig(companyId, { ...config, enabled });
}

/** value=null removes the override (reverts to company default) */
export async function updateDenominationBranchOverride(
  companyId: string,
  branchId: string,
  value: boolean | null
) {
  const config = await getDenominationConfig(companyId);
  const branch_overrides = { ...config.branch_overrides };
  if (value === null) {
    delete branch_overrides[branchId];
  } else {
    branch_overrides[branchId] = value;
  }
  return saveDenomConfig(companyId, { ...config, branch_overrides });
}

/** value=null removes the override (reverts to branch/company default) */
export async function updateDenominationCashbookOverride(
  companyId: string,
  cashbookId: string,
  value: boolean | null
) {
  const config = await getDenominationConfig(companyId);
  const cashbook_overrides = { ...config.cashbook_overrides };
  if (value === null) {
    delete cashbook_overrides[cashbookId];
  } else {
    cashbook_overrides[cashbookId] = value;
  }
  return saveDenomConfig(companyId, { ...config, cashbook_overrides });
}

/** @deprecated Use updateDenominationCompanySetting */
export async function updateDenominationSetting(companyId: string, enabled: boolean) {
  return updateDenominationCompanySetting(companyId, enabled);
}
