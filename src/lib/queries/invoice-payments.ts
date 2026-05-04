"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { invoicePaymentSchema, type InvoicePaymentFormValues } from "@/lib/validators/invoice";

export async function getInvoicePayments(invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createInvoicePayment(
  values: InvoicePaymentFormValues & {
    invoice_id: string;
    created_by: string;
  }
) {
  const validated = invoicePaymentSchema.parse(values);
  const supabase = await createClient();

  // invoice_payments has its own company_id / branch_id columns (RLS keys
  // off them). Inherit them from the parent invoice — leaving them NULL
  // makes the WITH CHECK policy fail with "new row violates row-level
  // security policy for table invoice_payments".
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("company_id, branch_id")
    .eq("id", values.invoice_id)
    .single();

  if (invErr || !invoice) {
    return { error: invErr?.message || "Invoice not found" };
  }

  const { error } = await supabase.from("invoice_payments").insert({
    invoice_id: values.invoice_id,
    company_id: invoice.company_id,
    branch_id: invoice.branch_id,
    payment_mode: validated.payment_mode,
    amount: validated.amount,
    reference_number: validated.reference_number || null,
    payment_date: validated.payment_date,
    notes: validated.notes || null,
    created_by: values.created_by,
  });

  if (error) return { error: error.message };
  revalidatePath(`/invoices`);
  revalidatePath(`/invoices/${values.invoice_id}`);
  return { success: true };
}
