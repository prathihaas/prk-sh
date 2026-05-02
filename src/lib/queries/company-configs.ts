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

// ── Telegram Bot Config ────────────────────────────────────────────────────

/** Get the Telegram bot token for a company */
export async function getTelegramBotToken(companyId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "telegram_bot_token")
    .maybeSingle();
  return (data?.config_value as string) || null;
}

// ── Telegram Day-Close Managers ────────────────────────────────────────────

export interface TelegramDayCloseConfig {
  company_manager_id: string | null;
  branch_overrides: Record<string, string | null>;
  cashbook_overrides: Record<string, string | null>;
}

function parseTelegramDayCloseConfig(raw: unknown): TelegramDayCloseConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    return {
      company_manager_id: (r.company_manager_id as string) || null,
      branch_overrides: (r.branch_overrides as Record<string, string | null>) || {},
      cashbook_overrides: (r.cashbook_overrides as Record<string, string | null>) || {},
    };
  }
  return { company_manager_id: null, branch_overrides: {}, cashbook_overrides: {} };
}

export async function getTelegramDayCloseConfig(companyId: string): Promise<TelegramDayCloseConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "telegram_day_close")
    .maybeSingle();
  return parseTelegramDayCloseConfig(data?.config_value);
}

/**
 * Resolve which manager should receive the day-close OTP for a given cashbook.
 * Hierarchy: cashbook override → branch override → company default.
 * Returns { userId, userName, chatId } or null if no manager is configured with a chat ID.
 */
export async function getTelegramDayCloseManager(
  companyId: string,
  branchId?: string | null,
  cashbookId?: string | null
): Promise<{ userId: string; userName: string; chatId: string } | null> {
  // Use admin to read user_profiles: the caller (cashier) cannot see other
  // users' rows under RLS, so a regular client returned no profile and the
  // page silently treated 'no manager configured' as 'no OTP needed' —
  // letting the cashier close the day without OTP even when a manager was
  // configured.
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const config = await getTelegramDayCloseConfig(companyId);

  let managerId: string | null = config.company_manager_id;

  if (branchId && branchId in config.branch_overrides) {
    managerId = config.branch_overrides[branchId];
  }
  if (cashbookId && cashbookId in config.cashbook_overrides) {
    managerId = config.cashbook_overrides[cashbookId];
  }

  if (!managerId) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id, full_name, telegram_chat_id")
    .eq("id", managerId)
    .maybeSingle();

  if (!profile?.telegram_chat_id) return null;

  return {
    userId: profile.id,
    userName: profile.full_name || "Manager",
    chatId: profile.telegram_chat_id,
  };
}

async function saveTelegramDayCloseConfig(companyId: string, config: TelegramDayCloseConfig) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "telegram_day_close", config_value: config },
      { onConflict: "company_id,config_key" }
    );
  if (error) return { error: error.message };
  revalidatePath("/settings/telegram");
  return { success: true };
}

export async function updateTelegramDayCloseConfig(
  companyId: string,
  patch: Partial<TelegramDayCloseConfig>
) {
  const existing = await getTelegramDayCloseConfig(companyId);
  return saveTelegramDayCloseConfig(companyId, { ...existing, ...patch });
}

export async function updateTelegramDayCloseCashbookOverride(
  companyId: string,
  cashbookId: string,
  managerId: string | null
) {
  const config = await getTelegramDayCloseConfig(companyId);
  const cashbook_overrides = { ...config.cashbook_overrides };
  if (managerId === null) {
    delete cashbook_overrides[cashbookId];
  } else {
    cashbook_overrides[cashbookId] = managerId;
  }
  return saveTelegramDayCloseConfig(companyId, { ...config, cashbook_overrides });
}

export async function updateTelegramDayCloseBranchOverride(
  companyId: string,
  branchId: string,
  managerId: string | null
) {
  const config = await getTelegramDayCloseConfig(companyId);
  const branch_overrides = { ...config.branch_overrides };
  if (managerId === null) {
    delete branch_overrides[branchId];
  } else {
    branch_overrides[branchId] = managerId;
  }
  return saveTelegramDayCloseConfig(companyId, { ...config, branch_overrides });
}

// ── Telegram Expense Approvers ─────────────────────────────────────────────
//
// Each level may have MULTIPLE approvers — every configured user gets the
// Telegram message and any one of them can approve. We keep both the legacy
// single-id field and the new *_ids arrays for backward compatibility on read;
// writes always populate the array form.

export interface TelegramExpenseApprovers {
  branch_approver_id: string | null;       // legacy (first id of array)
  accounts_approver_id: string | null;     // legacy
  owner_approver_id: string | null;        // legacy
  branch_approver_ids: string[];
  accounts_approver_ids: string[];
  owner_approver_ids: string[];
}

function uniq(arr: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of arr) {
    if (v && typeof v === "string" && !out.includes(v)) out.push(v);
  }
  return out;
}

function parseIdList(legacy: unknown, list: unknown): string[] {
  const ids: string[] = [];
  if (typeof legacy === "string" && legacy) ids.push(legacy);
  if (Array.isArray(list)) {
    for (const v of list) if (typeof v === "string" && v) ids.push(v);
  }
  return uniq(ids);
}

function parseTelegramExpenseApprovers(raw: unknown): TelegramExpenseApprovers {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const branch_ids = parseIdList(r.branch_approver_id, r.branch_approver_ids);
    const accounts_ids = parseIdList(r.accounts_approver_id, r.accounts_approver_ids);
    const owner_ids = parseIdList(r.owner_approver_id, r.owner_approver_ids);
    return {
      branch_approver_id: branch_ids[0] || null,
      accounts_approver_id: accounts_ids[0] || null,
      owner_approver_id: owner_ids[0] || null,
      branch_approver_ids: branch_ids,
      accounts_approver_ids: accounts_ids,
      owner_approver_ids: owner_ids,
    };
  }
  return {
    branch_approver_id: null,
    accounts_approver_id: null,
    owner_approver_id: null,
    branch_approver_ids: [],
    accounts_approver_ids: [],
    owner_approver_ids: [],
  };
}

export async function getTelegramExpenseApprovers(
  companyId: string
): Promise<TelegramExpenseApprovers> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "telegram_expense_approvers")
    .maybeSingle();
  return parseTelegramExpenseApprovers(data?.config_value);
}

export async function updateTelegramExpenseApprovers(
  companyId: string,
  approvers: TelegramExpenseApprovers
) {
  const supabase = await createClient();
  // Normalize: ensure arrays drive truth and legacy single-id mirrors first id
  const branch_ids = uniq(approvers.branch_approver_ids ?? []);
  const accounts_ids = uniq(approvers.accounts_approver_ids ?? []);
  const owner_ids = uniq(approvers.owner_approver_ids ?? []);
  const normalized: TelegramExpenseApprovers = {
    branch_approver_ids: branch_ids,
    accounts_approver_ids: accounts_ids,
    owner_approver_ids: owner_ids,
    branch_approver_id: branch_ids[0] || null,
    accounts_approver_id: accounts_ids[0] || null,
    owner_approver_id: owner_ids[0] || null,
  };
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "telegram_expense_approvers", config_value: normalized },
      { onConflict: "company_id,config_key" }
    );
  if (error) return { error: error.message };
  revalidatePath("/settings/telegram");
  return { success: true };
}
