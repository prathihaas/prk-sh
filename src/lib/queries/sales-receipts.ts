"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { salesReceiptSchema, type SalesReceiptFormValues } from "@/lib/validators/sales-receipt";
import { getCashLimits } from "@/lib/queries/company-configs";

/** Sum total cash received from a customer this financial year (across payment receipts + invoice payments) */
export async function getCashReceivedFromCustomer(
  companyId: string,
  customerId: string,
  financialYearId: string
): Promise<number> {
  const supabase = await createClient();

  // Cash from cashbook transactions (Payment Receipts)
  const { data: txns } = await supabase
    .from("cashbook_transactions")
    .select("amount")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .eq("txn_type", "receipt")
    .eq("payment_mode", "cash")
    .eq("financial_year_id", financialYearId)
    .eq("is_voided", false);

  // Cash from invoice payments (Sales Receipts and Invoices with cash payment)
  const { data: invPayments } = await supabase
    .from("invoice_payments")
    .select("amount, invoice:invoices!invoice_payments_invoice_id_fkey(customer_id, financial_year_id)")
    .eq("payment_mode", "cash")
    .eq("company_id", companyId);

  const txnTotal = (txns || []).reduce((sum: number, t: { amount: unknown }) => sum + Number(t.amount), 0);

  // Filter invoice payments by customer + FY
  const invTotal = (invPayments || [])
    .filter((p: Record<string, unknown>) => {
      const inv = p.invoice as { customer_id?: string; financial_year_id?: string } | null;
      return inv?.customer_id === customerId && inv?.financial_year_id === financialYearId;
    })
    .reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount), 0);

  return txnTotal + invTotal;
}

/** Get sales receipts for a company/branch (invoices where is_sales_receipt = true) */
export async function getSalesReceipts(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, dms_invoice_number, invoice_date, invoice_type, customer_name, grand_total, total_received, balance_due, approval_status, delivery_challan_number, created_at")
    .eq("company_id", companyId)
    .eq("is_sales_receipt", true)
    .order("invoice_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Create a Sales Receipt = Invoice + immediate full payment in one step */
export async function createSalesReceipt(
  values: SalesReceiptFormValues & {
    company_id: string;
    branch_id: string;
    created_by: string;
    financial_year_id: string;
  }
) {
  const validated = salesReceiptSchema.parse(values);
  const supabase = await createClient();

  // ── Guard required scope IDs ──────────────────────────────────────────────
  if (!values.company_id) return { error: "No company selected. Please select a company in the header." };
  if (!values.branch_id) return { error: "No branch selected. Please select a branch in the header." };
  if (!values.financial_year_id) return { error: "No active financial year found. Please configure a financial year." };

  // ── Cash limit check (Section 269ST) ────────────────────────────────────
  if (validated.payment_mode === "cash" && values.financial_year_id) {
    const limits = await getCashLimits(values.company_id);
    let existingCash = 0;
    if (validated.customer_id) {
      existingCash = await getCashReceivedFromCustomer(values.company_id, validated.customer_id, values.financial_year_id);
    }
    const newTotal = existingCash + validated.base_amount;
    if (newTotal > limits.customer_cash_per_fy) {
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
      return {
        error: `Cash limit exceeded (Section 269ST): Total cash from this customer this financial year would reach ${fmt(newTotal)}, exceeding the limit of ${fmt(limits.customer_cash_per_fy)}. Please use a non-cash payment mode.`,
      };
    }
  }

  // ── Calculate amounts ────────────────────────────────────────────────────
  const cgst = validated.tax_cgst || 0;
  const sgst = validated.tax_sgst || 0;
  const igst = validated.tax_igst || 0;
  const tcs = validated.tax_tcs || 0;
  const taxTotal = cgst + sgst + igst + tcs;
  const discount = validated.discount_amount || 0;
  const grandTotal = validated.base_amount - discount + taxTotal;

  const amountField: Record<string, number> = {};
  switch (validated.invoice_type) {
    case "automobile_sale": amountField.vehicle_sale_value = validated.base_amount; break;
    case "tractor_agri_sale": amountField.machine_value = validated.base_amount; break;
    case "service": amountField.labour_amount = validated.base_amount; break;
    default: amountField.other_charges = validated.base_amount;
  }

  // ── Build notes string (vehicle + insurance + finance metadata) ──────────
  const noteParts = [
    validated.notes || null,
    validated.vehicle_model ? `Model: ${validated.vehicle_model}` : null,
    validated.vehicle_variant ? `Variant: ${validated.vehicle_variant}` : null,
    validated.vin_number ? `VIN: ${validated.vin_number}` : null,
    validated.engine_number ? `Engine: ${validated.engine_number}` : null,
    validated.insurance_due && validated.insurance_company
      ? `Insurance: ${validated.insurance_company}`
      : null,
    validated.finance_due && validated.finance_company
      ? `Finance: ${validated.finance_company}`
      : null,
    validated.finance_due && validated.finance_amount
      ? `Finance Amt: ₹${validated.finance_amount.toLocaleString("en-IN")}`
      : null,
  ].filter((s): s is string => Boolean(s));

  // ── Create invoice ───────────────────────────────────────────────────────
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .insert({
      invoice_type: validated.invoice_type,
      customer_id: validated.customer_id || null,
      customer_name: validated.customer_name,
      customer_phone: validated.customer_phone || null,
      customer_gstin: validated.customer_gstin || null,
      dms_invoice_number: validated.dms_invoice_number || null,
      invoice_date: validated.invoice_date,
      ...amountField,
      discount_amount: discount,
      tax_breakup: { cgst, sgst, igst, cess: 0, tcs },
      total_tax: taxTotal,
      grand_total: grandTotal,
      notes: noteParts.join(" | ") || null,
      approval_status: "pending",
      company_id: values.company_id,
      branch_id: values.branch_id,
      financial_year_id: values.financial_year_id || null,
      created_by: values.created_by,
      is_sales_receipt: true,
      is_delivery_allowed: false,
    })
    .select("id, dms_invoice_number")
    .single();

  if (invError) return { error: invError.message };

  // ── For cash payment: try to post to the selected cashbook ───────────────
  let cashbookTxnId: string | null = null;
  const cashbookId = validated.cashbook_id || null;
  if (validated.payment_mode === "cash" && cashbookId) {
    const { data: day } = await supabase
      .from("cashbook_days")
      .select("id")
      .eq("cashbook_id", cashbookId)
      .eq("date", validated.invoice_date)
      .in("status", ["open", "reopened"])
      .single();

    if (day) {
      const narration = [
        `Sales Receipt - ${validated.customer_name}`,
        validated.dms_invoice_number
          ? `Ref: ${validated.dms_invoice_number}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const { data: txn } = await supabase
        .from("cashbook_transactions")
        .insert({
          cashbook_id: cashbookId,
          cashbook_day_id: day.id,
          company_id: values.company_id,
          branch_id: values.branch_id,
          financial_year_id: values.financial_year_id || null,
          txn_type: "receipt",
          amount: grandTotal,
          payment_mode: "cash",
          narration,
          party_name: validated.customer_name,
          customer_id: validated.customer_id || null,
          receipt_number: "PENDING",
          receipt_hash: "PENDING",
          created_by: values.created_by,
        })
        .select("id")
        .single();

      cashbookTxnId = txn?.id ?? null;
    }
    // If no open day: proceed without cashbook link, caller will show warning
  }

  // ── Record full payment immediately ─────────────────────────────────────
  const paymentRow: Record<string, unknown> = {
    invoice_id: invoice.id,
    company_id: values.company_id,
    branch_id: values.branch_id,
    payment_mode: validated.payment_mode,
    amount: grandTotal,
    reference_number: validated.payment_reference || null,
    payment_date: validated.invoice_date,
    created_by: values.created_by,
  };
  if (cashbookTxnId) {
    paymentRow.transaction_id = cashbookTxnId;
  }

  const { error: payError } = await supabase
    .from("invoice_payments")
    .insert(paymentRow);

  if (payError) {
    // Rollback invoice (and cashbook transaction if created)
    await supabase.from("invoices").delete().eq("id", invoice.id);
    if (cashbookTxnId) {
      await supabase
        .from("cashbook_transactions")
        .delete()
        .eq("id", cashbookTxnId);
    }
    return { error: payError.message };
  }

  revalidatePath("/sales/sales-receipts");
  revalidatePath("/invoices");
  if (cashbookId) revalidatePath("/cash/cashbooks");
  return {
    success: true,
    invoiceId: invoice.id,
    cashbookLinked: cashbookTxnId !== null,
  };
}
