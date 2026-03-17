"use server";

import { createClient } from "@/lib/supabase/server";
import type { TallySettings, TxnRow, TransferRow } from "@/lib/utils/tally-xml-generator";
import { defaultTallySettings } from "@/lib/utils/tally-xml-generator";

// ── Tally Settings (company_configs) ──────────────────────────

export async function getTallySettings(companyId: string): Promise<TallySettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "tally_settings")
    .single();

  if (!data?.config_value) return defaultTallySettings();
  return data.config_value as TallySettings;
}

// ── Cashbooks list (for mapping UI) ───────────────────────────

export async function getCashbooksForMapping(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashbooks")
    .select("id, name, type")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}

// ── Expense categories list (for mapping UI) ───────────────────

export async function getExpenseCategoriesForMapping(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}

// ── Transactions for export ────────────────────────────────────
// Fetches non-voided cashbook_transactions in the date range.
// Joins with cashbooks (for type/name) and expense category
// (via reference_id when reference_type='expense').

export async function getTxnsForExport(
  companyId: string,
  fromDate: string,
  toDate: string,
  branchId?: string | null
): Promise<TxnRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("cashbook_transactions")
    .select(`
      id,
      txn_type,
      amount,
      cashbook_id,
      narration,
      party_name,
      receipt_number,
      payment_mode,
      created_at,
      reference_type,
      reference_id,
      cashbook:cashbooks!cashbook_transactions_cashbook_id_fkey(id, name, type)
    `)
    .eq("company_id", companyId)
    .eq("is_voided", false)
    // Use IST offset (+05:30) so midnight-to-midnight is the Indian business day,
    // not the UTC day. This prevents transactions created near IST midnight from
    // landing in the wrong export file.
    .gte("created_at", fromDate + "T00:00:00+05:30")
    .lte("created_at", toDate + "T23:59:59+05:30")
    .order("created_at", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data: rawData, error } = await query;
  if (error) throw error;

  type RawTxnRow = {
    id: string;
    txn_type: string;
    amount: number;
    cashbook_id: string;
    narration: string;
    party_name: string | null;
    receipt_number: string;
    payment_mode: string;
    created_at: string;
    reference_type: string | null;
    reference_id: string | null;
    cashbook: { id: string; name: string; type: string } | null;
  };
  const data = (rawData || []) as RawTxnRow[];

  // Resolve expense category names for expense-linked payments
  const expenseIds = data
    .filter((t) => t.reference_type === "expense" && t.reference_id)
    .map((t) => t.reference_id as string);

  const categoryByExpenseId: Record<string, { id: string; name: string }> = {};

  if (expenseIds.length > 0) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, category_id, category:expense_categories(id, name)")
      .in("id", expenseIds);

    for (const exp of (expenses || []) as Array<{ id: string; category_id: string | null; category: { id: string; name: string } | null }>) {
      const cat = exp.category;
      if (cat) categoryByExpenseId[exp.id] = cat;
    }
  }

  return data.map((t) => {
    const cb = t.cashbook;
    const expCat =
      t.reference_type === "expense" && t.reference_id
        ? categoryByExpenseId[t.reference_id]
        : undefined;
    return {
      id: t.id,
      txn_type: t.txn_type as "receipt" | "payment",
      amount: t.amount,
      cashbook_id: t.cashbook_id,
      cashbook_name: cb?.name || t.cashbook_id,
      narration: t.narration,
      party_name: t.party_name,
      receipt_number: t.receipt_number,
      payment_mode: t.payment_mode,
      created_at: t.created_at,
      expense_category_id: expCat?.id || null,
      expense_category_name: expCat?.name || null,
    } satisfies TxnRow;
  });
}

// ── Transfers for export ───────────────────────────────────────

export async function getTransfersForExport(
  companyId: string,
  fromDate: string,
  toDate: string,
  branchId?: string | null
): Promise<TransferRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("cashbook_transfers")
    .select(`
      id,
      amount,
      from_cashbook_id,
      to_cashbook_id,
      description,
      transfer_date,
      from_cb:cashbooks!cashbook_transfers_from_cashbook_id_fkey(id, name),
      to_cb:cashbooks!cashbook_transfers_to_cashbook_id_fkey(id, name)
    `)
    .eq("company_id", companyId)
    .eq("status", "approved")
    .gte("transfer_date", fromDate)
    .lte("transfer_date", toDate)
    .order("transfer_date", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data: rawData, error } = await query;
  if (error) throw error;

  type RawTransferRow = {
    id: string;
    amount: number;
    from_cashbook_id: string;
    to_cashbook_id: string;
    description: string | null;
    transfer_date: string;
    from_cb: { id: string; name: string } | null;
    to_cb: { id: string; name: string } | null;
  };
  const data = (rawData || []) as RawTransferRow[];

  return data.map((tr) => {
    const fromCb = tr.from_cb;
    const toCb = tr.to_cb;
    return {
      id: tr.id,
      amount: tr.amount,
      from_cashbook_id: tr.from_cashbook_id,
      from_cashbook_name: fromCb?.name || tr.from_cashbook_id,
      to_cashbook_id: tr.to_cashbook_id,
      to_cashbook_name: toCb?.name || tr.to_cashbook_id,
      description: tr.description,
      transfer_date: tr.transfer_date,
    } satisfies TransferRow;
  });
}

// ── Export history ─────────────────────────────────────────────

export interface TallyExportBatch {
  id: string;
  from_date: string;
  to_date: string;
  voucher_count: number;
  exported_at: string;
  filename: string | null;
  notes: string | null;
  exporter: { full_name: string } | null;
}

export async function getTallyExportHistory(companyId: string, limit = 20): Promise<TallyExportBatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tally_export_batches")
    .select(`
      id,
      from_date,
      to_date,
      voucher_count,
      exported_at,
      filename,
      notes,
      exporter:user_profiles!tally_export_batches_exported_by_fkey(full_name)
    `)
    .eq("company_id", companyId)
    .order("exported_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as TallyExportBatch[];
}

export async function logTallyExport(payload: {
  company_id: string;
  branch_id?: string | null;
  from_date: string;
  to_date: string;
  voucher_count: number;
  exported_by: string;
  filename: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("tally_export_batches").insert(payload);
  if (error) console.error("Failed to log Tally export:", error.message);
}
