"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompanyDue {
  id: string;
  due_type: "insurance" | "finance";
  company_name: string;
  total_amount: number;
  received_amount: number;
  balance_amount: number;
  status: "pending" | "partial" | "settled";
  invoice_id: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  invoice?: {
    dms_invoice_number: string | null;
    customer_name: string;
    invoice_date: string;
  } | null;
}

export interface GetCompanyDuesFilters {
  due_type?: "insurance" | "finance";
  status?: "pending" | "partial" | "settled";
}

/** List company dues (insurance / finance receivables) for a company/branch */
export async function getCompanyDues(
  companyId: string,
  branchId?: string | null,
  filters?: GetCompanyDuesFilters
): Promise<CompanyDue[]> {
  const supabase = await createClient();

  let query = supabase
    .from("company_dues")
    .select(`
      id,
      due_type,
      company_name,
      total_amount,
      received_amount,
      balance_amount,
      status,
      invoice_id,
      due_date,
      notes,
      created_at,
      invoice:invoices!company_dues_invoice_id_fkey(
        dms_invoice_number,
        customer_name,
        invoice_date
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.due_type) query = query.eq("due_type", filters.due_type);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as CompanyDue[];
}

/** Mark a portion of a company due as received */
export async function markDueReceived(
  dueId: string,
  {
    amount,
    notes,
    receivedBy,
  }: {
    amount: number;
    notes?: string;
    receivedBy: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const supabase = await createClient();

  // Fetch current state
  const { data: due, error: fetchError } = await supabase
    .from("company_dues")
    .select("id, total_amount, received_amount, balance_amount, status")
    .eq("id", dueId)
    .single();

  if (fetchError || !due) return { error: "Due record not found." };
  if (due.status === "settled") return { error: "This due is already settled." };

  const newReceived = Number(due.received_amount) + amount;
  if (newReceived > Number(due.total_amount)) {
    return {
      error: `Amount exceeds balance. Balance remaining: ₹${Number(due.balance_amount).toLocaleString("en-IN")}`,
    };
  }

  const newStatus: "pending" | "partial" | "settled" =
    newReceived >= Number(due.total_amount) ? "settled" : "partial";

  const noteText = [
    due.notes || null,
    `Received ₹${amount.toLocaleString("en-IN")} on ${new Date().toLocaleDateString("en-IN")}`,
    notes || null,
  ]
    .filter(Boolean)
    .join(" | ");

  const { error: updateError } = await supabase
    .from("company_dues")
    .update({
      received_amount: newReceived,
      status: newStatus,
      notes: noteText,
    })
    .eq("id", dueId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/reports/company-dues");
  return { success: true };
}
