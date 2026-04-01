"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveOrCreateCashbookDay } from "@/lib/queries/cashbook-days";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CashbookTransferInput {
  company_id: string;
  branch_id?: string | null;
  financial_year_id?: string | null;
  from_cashbook_id: string;
  to_cashbook_id: string;
  amount: number;
  description: string;
  transfer_date: string; // ISO date "YYYY-MM-DD"
  created_by: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// List transfers
// ─────────────────────────────────────────────────────────────────────────────

export async function getCashbookTransfers(
  companyId: string,
  branchId?: string | null,
  statusFilter?: "pending" | "approved" | "rejected" | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("cashbook_transfers")
    .select(
      `*,
       from_cashbook:cashbooks!cashbook_transfers_from_cashbook_id_fkey(id, name, type),
       to_cashbook:cashbooks!cashbook_transfers_to_cashbook_id_fkey(id, name, type),
       creator:user_profiles!cashbook_transfers_created_by_fkey(id, full_name, email),
       approver:user_profiles!cashbook_transfers_approved_by_fkey(id, full_name, email)`
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Get single transfer
// ─────────────────────────────────────────────────────────────────────────────

export async function getCashbookTransfer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashbook_transfers")
    .select(
      `*,
       from_cashbook:cashbooks!cashbook_transfers_from_cashbook_id_fkey(id, name, type),
       to_cashbook:cashbooks!cashbook_transfers_to_cashbook_id_fkey(id, name, type),
       creator:user_profiles!cashbook_transfers_created_by_fkey(id, full_name, email),
       approver:user_profiles!cashbook_transfers_approved_by_fkey(id, full_name, email)`
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create transfer request (status = pending)
// ─────────────────────────────────────────────────────────────────────────────

export async function createCashbookTransfer(values: CashbookTransferInput) {
  if (values.from_cashbook_id === values.to_cashbook_id) {
    return { error: "Source and destination cashbooks must be different." };
  }
  if (!values.amount || values.amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }
  if (!values.description?.trim()) {
    return { error: "Description is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cashbook_transfers").insert({
    company_id: values.company_id,
    branch_id: values.branch_id || null,
    financial_year_id: values.financial_year_id || null,
    from_cashbook_id: values.from_cashbook_id,
    to_cashbook_id: values.to_cashbook_id,
    amount: values.amount,
    description: values.description.trim(),
    transfer_date: values.transfer_date,
    status: "pending",
    created_by: values.created_by,
  });

  if (error) return { error: error.message };
  revalidatePath("/cash/cashbook-transfers");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve transfer — creates cashbook transactions and debits/credits
// ─────────────────────────────────────────────────────────────────────────────

export async function approveCashbookTransfer(
  transferId: string,
  approvedBy: string
) {
  const supabase = await createClient();

  // 1. Fetch the pending transfer
  const { data: transfer, error: fetchErr } = await supabase
    .from("cashbook_transfers")
    .select("*")
    .eq("id", transferId)
    .single();

  if (fetchErr || !transfer) return { error: "Transfer not found." };
  if (transfer.status !== "pending") {
    return { error: `Transfer is already ${transfer.status}.` };
  }

  // 2. Resolve cashbook days for BOTH cashbooks — auto-creates for bank accounts
  const [fromDayResult, toDayResult] = await Promise.all([
    resolveOrCreateCashbookDay(transfer.from_cashbook_id, transfer.transfer_date),
    resolveOrCreateCashbookDay(transfer.to_cashbook_id, transfer.transfer_date),
  ]);

  if ("error" in fromDayResult) {
    return { error: `Source cashbook: ${fromDayResult.error}` };
  }
  if ("error" in toDayResult) {
    return { error: `Destination cashbook: ${toDayResult.error}` };
  }

  const fromDayId = fromDayResult.day.id;
  const toDayId = toDayResult.day.id;
  const narration = `Cashbook Transfer: ${transfer.description}`;

  // 3. Create DEBIT transaction in the source cashbook
  const { data: fromTxn, error: fromTxnErr } = await supabase
    .from("cashbook_transactions")
    .insert({
      cashbook_id: transfer.from_cashbook_id,
      cashbook_day_id: fromDayId,
      company_id: transfer.company_id,
      branch_id: transfer.branch_id,
      financial_year_id: transfer.financial_year_id,
      txn_type: "payment",
      amount: transfer.amount,
      payment_mode: "bank_transfer",
      narration,
      party_name: "Internal Transfer",
      receipt_number: "PENDING",
      receipt_hash: "PENDING",
      created_by: approvedBy,
      reference_type: "cashbook_transfer",
      reference_id: transferId,
    })
    .select("id")
    .single();

  if (fromTxnErr) return { error: `Failed to create debit: ${fromTxnErr.message}` };

  // 4. Create CREDIT transaction in the destination cashbook
  const { data: toTxn, error: toTxnErr } = await supabase
    .from("cashbook_transactions")
    .insert({
      cashbook_id: transfer.to_cashbook_id,
      cashbook_day_id: toDayId,
      company_id: transfer.company_id,
      branch_id: transfer.branch_id,
      financial_year_id: transfer.financial_year_id,
      txn_type: "receipt",
      amount: transfer.amount,
      payment_mode: "bank_transfer",
      narration,
      party_name: "Internal Transfer",
      receipt_number: "PENDING",
      receipt_hash: "PENDING",
      created_by: approvedBy,
      reference_type: "cashbook_transfer",
      reference_id: transferId,
    })
    .select("id")
    .single();

  if (toTxnErr) {
    // Rollback: void the debit transaction so books stay balanced
    await supabase
      .from("cashbook_transactions")
      .update({ is_voided: true, void_reason: "Transfer approval failed — credit not created" })
      .eq("id", fromTxn.id);
    return { error: `Failed to create credit: ${toTxnErr.message}` };
  }

  // 5. Mark transfer as approved with transaction references
  const { error: updateErr } = await supabase
    .from("cashbook_transfers")
    .update({
      status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      from_txn_id: fromTxn.id,
      to_txn_id: toTxn.id,
    })
    .eq("id", transferId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath("/cash/cashbook-transfers");
  revalidatePath("/cash/cashbooks");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject transfer
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectCashbookTransfer(
  transferId: string,
  rejectedBy: string,
  reason: string
) {
  if (!reason?.trim() || reason.trim().length < 5) {
    return { error: "Please provide a reason (at least 5 characters)." };
  }

  const supabase = await createClient();

  const { data: transfer } = await supabase
    .from("cashbook_transfers")
    .select("status")
    .eq("id", transferId)
    .single();

  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "pending") {
    return { error: `Transfer is already ${transfer.status}.` };
  }

  const { error } = await supabase
    .from("cashbook_transfers")
    .update({
      status: "rejected",
      reject_reason: reason.trim(),
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", transferId);

  if (error) return { error: error.message };
  revalidatePath("/cash/cashbook-transfers");
  return { success: true };
}
