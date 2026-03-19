"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingRoJob {
  id: string;
  company_id: string;
  branch_id: string | null;
  ro_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;
  vin_number: string | null;
  engine_number: string | null;
  description: string | null;
  estimated_amount: number | null;
  ro_closed_date: string;
  created_at: string;
  invoice_id: string | null;
  completed_at: string | null;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Get all active pending R/O jobs (not removed).
 * Returns open (not completed) first, then completed ones from today.
 */
export async function getPendingRoJobs(
  companyId: string,
  branchId?: string | null
): Promise<PendingRoJob[]> {
  const supabase = await createClient();

  let query = supabase
    .from("pending_ro_jobs")
    .select("*")
    .eq("company_id", companyId)
    .is("removed_at", null)
    .order("completed_at", { ascending: false, nullsFirst: true })
    .order("ro_closed_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PendingRoJob[];
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createPendingRoJob(values: {
  company_id: string;
  branch_id: string;
  ro_number?: string;
  customer_name: string;
  customer_phone?: string;
  vehicle_model?: string;
  vehicle_variant?: string;
  vin_number?: string;
  engine_number?: string;
  description?: string;
  estimated_amount?: number;
  ro_closed_date: string;
  created_by: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("pending_ro_jobs").insert({
    company_id: values.company_id,
    branch_id: values.branch_id,
    ro_number: values.ro_number || null,
    customer_name: values.customer_name,
    customer_phone: values.customer_phone || null,
    vehicle_model: values.vehicle_model || null,
    vehicle_variant: values.vehicle_variant || null,
    vin_number: values.vin_number || null,
    engine_number: values.engine_number || null,
    description: values.description || null,
    estimated_amount: values.estimated_amount || null,
    ro_closed_date: values.ro_closed_date,
    created_by: values.created_by,
  });

  if (error) return { error: error.message };
  revalidatePath("/sales/pending-ro");
  return { success: true };
}

/**
 * Mark an R/O as completed (payment received, sales receipt created).
 */
export async function completePendingRoJob(
  id: string,
  invoiceId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pending_ro_jobs")
    .update({
      invoice_id: invoiceId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  // No revalidatePath here — caller always navigates away to /invoices/:id
  // so revalidating this page while the user is on it would cause an
  // unwanted page re-render that resets state and aborts the navigation.
  // The page is dynamic (uses cookies), so it fetches fresh data on next visit.
  return { success: true };
}

/**
 * Soft-remove an R/O from the pending list (e.g. cancelled job).
 */
export async function removePendingRoJob(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pending_ro_jobs")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/sales/pending-ro");
  return { success: true };
}
