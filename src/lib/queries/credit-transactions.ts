"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveOrCreateCashbookDay } from "@/lib/queries/cashbook-days";

export interface CreditTransaction {
  id: string;
  source: "invoice_payment" | "cashbook_transaction";
  date: string;
  party_name: string;
  amount: number;
  description: string;
  invoice_id: string | null;
  invoice_number: string | null;
  settled_at: string | null;
  settled_by_name: string | null;
}

/** Get all open credit transactions (invoice payments + cashbook receipts with mode=credit) */
export async function getCreditTransactions(
  companyId: string,
  branchId?: string | null,
  showSettled = false
): Promise<CreditTransaction[]> {
  const supabase = await createClient();

  // 1. Invoice payments with mode = credit
  let invQuery = supabase
    .from("invoice_payments")
    .select(`
      id,
      payment_date,
      amount,
      settled_at,
      settled_by,
      invoice:invoices!invoice_payments_invoice_id_fkey(
        id,
        dms_invoice_number,
        customer_name,
        invoice_type
      )
    `)
    .eq("company_id", companyId)
    .eq("payment_mode", "credit")
    .order("payment_date", { ascending: false });

  if (branchId) invQuery = invQuery.eq("branch_id", branchId);
  if (!showSettled) invQuery = invQuery.is("settled_at", null);

  const { data: invPayments } = await invQuery;

  // 2. Cashbook receipt transactions with mode = credit
  let txnQuery = supabase
    .from("cashbook_transactions")
    .select(`
      id,
      created_at,
      amount,
      narration,
      party_name,
      is_voided
    `)
    .eq("company_id", companyId)
    .eq("payment_mode", "credit")
    .eq("txn_type", "receipt")
    .eq("is_voided", false)
    .order("created_at", { ascending: false });

  if (branchId) txnQuery = txnQuery.eq("branch_id", branchId);

  const { data: txns } = await txnQuery;

  const results: CreditTransaction[] = [];

  // Map invoice payments
  for (const p of invPayments || []) {
    const inv = p.invoice as {
      id?: string;
      dms_invoice_number?: string | null;
      customer_name?: string;
      invoice_type?: string;
    } | null;
    results.push({
      id: p.id,
      source: "invoice_payment",
      date: p.payment_date,
      party_name: inv?.customer_name || "Unknown",
      amount: Number(p.amount),
      description: `Sales Receipt — ${inv?.invoice_type?.replace(/_/g, " ") || "Invoice"}`,
      invoice_id: inv?.id || null,
      invoice_number: inv?.dms_invoice_number || null,
      settled_at: p.settled_at || null,
      settled_by_name: null, // join omitted for brevity
    });
  }

  // Map cashbook transactions
  for (const t of txns || []) {
    results.push({
      id: t.id,
      source: "cashbook_transaction",
      date: (t.created_at as string).split("T")[0],
      party_name: t.party_name || "Unknown",
      amount: Number(t.amount),
      description: t.narration || "Payment Receipt",
      invoice_id: null,
      invoice_number: null,
      settled_at: null, // cashbook txns don't have settled_at yet
      settled_by_name: null,
    });
  }

  // Sort combined list by date descending
  return results.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Settle a credit invoice payment by linking a cashbook transaction */
export async function settleCreditInvoicePayment(
  invoicePaymentId: string,
  {
    cashbookId,
    cashbookDayId: _cashbookDayId,
    paymentDate,
    paymentMode,
    amount,
    narration,
    companyId,
    branchId,
    financialYearId,
    settledBy,
  }: {
    cashbookId: string;
    cashbookDayId: string;
    paymentDate: string;
    paymentMode: string;
    amount: number;
    narration?: string;
    companyId: string;
    branchId: string;
    financialYearId?: string | null;
    settledBy: string;
  }
): Promise<{ success?: boolean; error?: string; transactionId?: string }> {
  const supabase = await createClient();

  // Fetch the credit invoice payment
  const { data: payment, error: fetchError } = await supabase
    .from("invoice_payments")
    .select("id, amount, settled_at, invoice_id, invoice:invoices!invoice_payments_invoice_id_fkey(customer_name, dms_invoice_number, financial_year_id)")
    .eq("id", invoicePaymentId)
    .single();

  if (fetchError || !payment) return { error: "Credit transaction not found." };
  if (payment.settled_at) return { error: "This credit transaction is already settled." };

  const inv = payment.invoice as {
    customer_name?: string;
    dms_invoice_number?: string | null;
    financial_year_id?: string | null;
  } | null;

  const fyId = financialYearId ?? inv?.financial_year_id ?? null;

  // Resolve cashbook day — auto-creates for bank accounts, requires open day for cash
  const dayResult = await resolveOrCreateCashbookDay(cashbookId, paymentDate);
  if ("error" in dayResult) return dayResult;
  const day = dayResult.day;

  // Create a cashbook transaction for the payment received
  const txnNarration = narration ||
    `Credit settlement — ${inv?.customer_name || ""}${inv?.dms_invoice_number ? ` | Ref: ${inv.dms_invoice_number}` : ""}`;

  const { data: txn, error: txnError } = await supabase
    .from("cashbook_transactions")
    .insert({
      cashbook_id: cashbookId,
      cashbook_day_id: day.id,
      company_id: companyId,
      branch_id: branchId,
      financial_year_id: fyId,
      txn_type: "receipt",
      amount,
      payment_mode: paymentMode,
      narration: txnNarration,
      party_name: inv?.customer_name || "",
      receipt_number: "PENDING",
      receipt_hash: "PENDING",
      created_by: settledBy,
    })
    .select("id")
    .single();

  if (txnError || !txn) {
    return { error: txnError?.message ?? "Failed to create cashbook transaction." };
  }

  // Mark the invoice payment as settled
  const { error: settleError } = await supabase
    .from("invoice_payments")
    .update({
      settled_at: new Date().toISOString(),
      settled_by: settledBy,
    })
    .eq("id", invoicePaymentId);

  if (settleError) {
    // Rollback the cashbook transaction
    await supabase.from("cashbook_transactions").delete().eq("id", txn.id);
    return { error: settleError.message };
  }

  revalidatePath("/reports/credit-transactions");
  revalidatePath("/cash/cashbooks");
  return { success: true, transactionId: txn.id };
}
