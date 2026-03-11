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

  const { error } = await supabase.from("invoice_payments").insert({
    invoice_id: values.invoice_id,
    payment_mode: validated.payment_mode,
    amount: validated.amount,
    reference_number: validated.reference_number || null,
    payment_date: validated.payment_date,
    notes: validated.notes || null,
    created_by: values.created_by,
  });

  if (error) return { error: error.message };
  revalidatePath(`/invoices`);
  return { success: true };
}
