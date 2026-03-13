"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { invoiceSchema, type InvoiceFormValues } from "@/lib/validators/invoice";

export async function getInvoices(
  companyId: string,
  branchId?: string | null,
  filters?: { type?: string; status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .order("invoice_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.type) query = query.eq("invoice_type", filters.type);
  if (filters?.status) query = query.eq("approval_status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getDueInvoices(companyId: string, branchId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_cancelled", false)
    .eq("is_settled", false)
    .gt("balance_due", 0)
    .order("invoice_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Maps the UI base_amount to the correct per-type DB amount column */
function getAmountFields(invoiceType: string, baseAmount: number) {
  switch (invoiceType) {
    case "automobile_sale": return { vehicle_sale_value: baseAmount };
    case "tractor_agri_sale": return { machine_value: baseAmount };
    case "service": return { labour_amount: baseAmount };
    default: return { other_charges: baseAmount }; // bank_payment, other_income
  }
}

export async function createInvoice(
  values: InvoiceFormValues & {
    company_id: string;
    branch_id: string;
    created_by: string;
    financial_year_id: string;
  }
) {
  const validated = invoiceSchema.parse(values);
  const supabase = await createClient();

  const taxTotal = (validated.tax_breakup?.cgst || 0) + (validated.tax_breakup?.sgst || 0) +
    (validated.tax_breakup?.igst || 0) + (validated.tax_breakup?.cess || 0);
  const grandTotal = validated.base_amount - (validated.discount_amount || 0) + taxTotal;
  const amountFields = getAmountFields(validated.invoice_type, validated.base_amount);

  const { error } = await supabase.from("invoices").insert({
    invoice_type: validated.invoice_type,
    customer_name: validated.customer_name,
    customer_gstin: validated.customer_gstin || null,
    customer_phone: validated.customer_phone || null,
    dms_invoice_number: validated.dms_invoice_number || null,
    invoice_date: validated.invoice_date,
    finance_company_name: validated.finance_company_name || null,
    loan_account_ref: validated.loan_account_ref || null,
    income_category: validated.income_category || null,
    income_ref_number: validated.income_ref_number || null,
    ...amountFields,
    discount_amount: validated.discount_amount || 0,
    tax_breakup: validated.tax_breakup,
    total_tax: taxTotal,
    grand_total: grandTotal,
    notes: validated.notes || null,
    company_id: values.company_id,
    branch_id: values.branch_id,
    created_by: values.created_by,
    financial_year_id: values.financial_year_id,
  });

  if (error) return { error: error.message };
  revalidatePath("/invoices");
  return { success: true };
}

export async function updateInvoice(id: string, values: InvoiceFormValues) {
  const validated = invoiceSchema.parse(values);
  const supabase = await createClient();

  const taxTotal = (validated.tax_breakup?.cgst || 0) + (validated.tax_breakup?.sgst || 0) +
    (validated.tax_breakup?.igst || 0) + (validated.tax_breakup?.cess || 0);
  const grandTotal = validated.base_amount - (validated.discount_amount || 0) + taxTotal;
  const amountFields = getAmountFields(validated.invoice_type, validated.base_amount);

  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_type: validated.invoice_type,
      customer_name: validated.customer_name,
      customer_gstin: validated.customer_gstin || null,
      customer_phone: validated.customer_phone || null,
      dms_invoice_number: validated.dms_invoice_number || null,
      invoice_date: validated.invoice_date,
      finance_company_name: validated.finance_company_name || null,
      loan_account_ref: validated.loan_account_ref || null,
      income_category: validated.income_category || null,
      income_ref_number: validated.income_ref_number || null,
      ...amountFields,
      discount_amount: validated.discount_amount || 0,
      tax_breakup: validated.tax_breakup,
      total_tax: taxTotal,
      grand_total: grandTotal,
      notes: validated.notes || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invoices");
  return { success: true };
}

export async function cancelInvoice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ approval_status: "cancelled", is_cancelled: true })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invoices");
  return { success: true };
}

export async function generateDeliveryChallan(
  invoiceId: string,
  deliveryAddress: string
) {
  const supabase = await createClient();

  // Check if challan already generated
  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("branch_id, delivery_challan_number, financial_year_id")
    .eq("id", invoiceId)
    .single();

  if (fetchError) return { error: fetchError.message };
  if (invoice.delivery_challan_number) {
    return { success: true, challan_number: invoice.delivery_challan_number };
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("code")
    .eq("id", invoice.branch_id)
    .single();

  if (branchError) return { error: branchError.message };

  // Generate challan number: DC/{branch_code}/{YYMMDD}/{seq}
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, "").substring(2);
  const seq = Math.floor(Math.random() * 9000) + 1000;
  const challanNumber = `DC/${branch.code}/${dateStr}/${seq}`;

  const { error } = await supabase
    .from("invoices")
    .update({
      delivery_challan_number: challanNumber,
      delivery_challan_date: today.toISOString().split("T")[0],
      delivery_address: deliveryAddress || null,
    })
    .eq("id", invoiceId);

  if (error) return { error: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true, challan_number: challanNumber };
}
