"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { receiptSchema, type ReceiptFormValues } from "@/lib/validators/receipt";
import { getCashLimits } from "@/lib/queries/company-configs";

/**
 * Get all receipt-type transactions across all cashbooks for a company/branch scope.
 */
export async function getReceipts(
  companyId: string,
  branchId?: string | null,
  filters?: { payment_mode?: string; status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("cashbook_transactions")
    .select(`
      *,
      creator:user_profiles!cashbook_transactions_created_by_fkey(id, full_name, email)
    `)
    .eq("txn_type", "receipt")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }
  if (filters?.payment_mode) {
    query = query.eq("payment_mode", filters.payment_mode);
  }
  if (filters?.status === "voided") {
    query = query.eq("is_voided", true);
  } else if (filters?.status === "active") {
    query = query.eq("is_voided", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get a single receipt with full context (transaction + cashbook + company + branch)
 * for the printable receipt view.
 */
export async function getReceiptWithContext(id: string) {
  const supabase = await createClient();

  // Get the transaction
  const { data: transaction, error: txnError } = await supabase
    .from("cashbook_transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (txnError) throw txnError;

  // Get the cashbook
  const { data: cashbook } = await supabase
    .from("cashbooks")
    .select("*")
    .eq("id", transaction.cashbook_id)
    .single();

  // Get the company — explicitly select fields so PrintReceipt gets gstin + logo_url
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, gstin, address, logo_url")
    .eq("id", transaction.company_id)
    .single();

  // Get the branch
  const { data: branch } = await supabase
    .from("branches")
    .select("*")
    .eq("id", transaction.branch_id)
    .single();

  return { transaction, cashbook, company, branch };
}

/**
 * Create a receipt in a cashbook.
 * Validates that the date has an open (or reopened) cashbook day.
 * Blocks backdating: receipt date cannot be before today unless user has RECEIPT_BACKDATE permission.
 */
export async function createReceipt(
  values: ReceiptFormValues & {
    company_id: string;
    branch_id: string;
    created_by: string;
    financial_year_id?: string;
    allow_backdate?: boolean; // Only true if user has RECEIPT_BACKDATE permission
    require_otp_approval?: boolean; // Set receipt_approval_status to pending_cashier
  }
) {
  const validated = receiptSchema.parse(values);
  const supabase = await createClient();

  // Backdate protection: if date is before today and user doesn't have backdate permission, block it
  const today = new Date().toISOString().split("T")[0];
  if (validated.date < today && !values.allow_backdate) {
    return {
      error:
        "Backdated receipts are not allowed. You cannot enter a receipt with a date earlier than today. Contact your manager if you need special backdating access.",
    };
  }

  // ── Cash limit enforcement (Section 269ST) ──────────────────────────────
  // Block if this receipt would push the customer's total cash receipts over the legal limit
  if (validated.payment_mode === "cash" && validated.customer_id) {
    const customerId = validated.customer_id;
    const limits = await getCashLimits(values.company_id);

    // Sum all non-voided cash receipts for this customer this financial year
    const { data: existingTxns } = await supabase
      .from("cashbook_transactions")
      .select("amount")
      .eq("company_id", values.company_id)
      .eq("customer_id", customerId)
      .eq("txn_type", "receipt")
      .eq("payment_mode", "cash")
      .eq("is_voided", false)
      .eq("financial_year_id", values.financial_year_id || "");

    const existingCash = (existingTxns || []).reduce((sum: number, t: { amount: unknown }) => sum + Number(t.amount), 0);
    const newTotal = existingCash + Number(validated.amount);

    if (newTotal > limits.customer_cash_per_fy) {
      const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
      return {
        error: `Cash limit exceeded (Section 269ST): This customer has already received ${fmt(existingCash)} in cash this financial year. Adding ${fmt(Number(validated.amount))} would exceed the limit of ${fmt(limits.customer_cash_per_fy)}. Use a non-cash payment mode.`,
      };
    }
  }

  // Find an open/reopened day for this cashbook + date
  const { data: day, error: dayError } = await supabase
    .from("cashbook_days")
    .select("id, status")
    .eq("cashbook_id", validated.cashbook_id)
    .eq("date", validated.date)
    .in("status", ["open", "reopened"])
    .single();

  if (dayError || !day) {
    return {
      error:
        "No open cashbook day found for this date. The day may be closed or does not exist yet. Please open the day first from the Cashbooks section.",
    };
  }

  // Insert the receipt transaction, returning the ID for OTP approval flow
  const { data: inserted, error } = await supabase
    .from("cashbook_transactions")
    .insert({
      cashbook_id: validated.cashbook_id,
      cashbook_day_id: day.id,
      company_id: values.company_id,
      branch_id: values.branch_id,
      financial_year_id: values.financial_year_id || null,
      txn_type: "receipt",
      amount: validated.amount,
      payment_mode: validated.payment_mode,
      narration: validated.narration,
      party_name: validated.party_name,
      customer_id: validated.customer_id || null,
      receipt_number: "PENDING", // DB trigger generates this
      receipt_hash: "PENDING", // DB trigger generates this
      created_by: values.created_by,
      receipt_approval_status: values.require_otp_approval ? "pending_cashier" : "approved",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/cash/receipts");
  revalidatePath("/cash/cashbooks");
  return { success: true, receiptId: inserted.id };
}

/**
 * Receipts CANNOT be deleted — they can only be voided.
 * This function blocks deletion attempts and enforces void-only workflow.
 * Only users with RECEIPT_DELETE permission AND an approval can void a receipt.
 */
export async function voidReceipt(
  receiptId: string,
  reason: string,
  voidedBy: string,
  hasDeletePermission: boolean
) {
  if (!hasDeletePermission) {
    return {
      error:
        "You do not have permission to void receipts. Only authorized users with approval can void a receipt.",
    };
  }

  if (!reason || reason.trim().length < 5) {
    return { error: "A valid reason (at least 5 characters) is required to void a receipt." };
  }

  const supabase = await createClient();

  // Check the receipt is not already voided
  const { data: receipt, error: fetchError } = await supabase
    .from("cashbook_transactions")
    .select("id, is_voided, receipt_number")
    .eq("id", receiptId)
    .single();

  if (fetchError || !receipt) {
    return { error: "Receipt not found." };
  }

  if (receipt.is_voided) {
    return { error: "This receipt has already been voided." };
  }

  const { error } = await supabase
    .from("cashbook_transactions")
    .update({
      is_voided: true,
      void_reason: reason,
      voided_by: voidedBy,
      voided_at: new Date().toISOString(),
    })
    .eq("id", receiptId);

  if (error) return { error: error.message };

  revalidatePath("/cash/receipts");
  return { success: true };
}

/**
 * Get active cashbooks for a branch (for receipt/expense cashbook selection).
 * Banks are company-wide; cash/petty are branch-specific.
 * Uses two separate queries to avoid PostgREST .or() issues.
 */
export async function getActiveCashbooks(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();

  if (branchId) {
    // Cash/petty filtered by branch; bank accounts are company-wide
    const [cashResult, bankResult] = await Promise.all([
      supabase
        .from("cashbooks")
        .select("id, name, type")
        .eq("company_id", companyId)
        .eq("branch_id", branchId)
        .in("type", ["main", "petty"])
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("cashbooks")
        .select("id, name, type")
        .eq("company_id", companyId)
        .eq("type", "bank")
        .eq("is_active", true)
        .order("name"),
    ]);
    if (cashResult.error) throw cashResult.error;
    if (bankResult.error) throw bankResult.error;
    return [...(cashResult.data || []), ...(bankResult.data || [])];
  }

  // No branchId: return all active cashbooks for the company
  const { data, error } = await supabase
    .from("cashbooks")
    .select("id, name, type")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}
