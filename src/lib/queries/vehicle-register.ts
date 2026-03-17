"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VehicleStatus, ShopType } from "@/lib/constants/vehicle-register";

export interface CreateVehicleValues {
  company_id: string;
  branch_id: string;
  financial_year_id?: string;
  shop_type: ShopType;
  model: string;
  registration_number: string;
  customer_name?: string;
  notes?: string;
  created_by: string;
}

export interface VehicleReportRow {
  id: string;
  model: string;
  registration_number: string;
  customer_name: string | null;
  shop_type: string;
  status: string;
  ro_number: string | null;
  is_insurance_claim: boolean;
  arrived_at: string | null;
  ro_opened_at: string | null;
  insurance_approved_at: string | null;
  work_started_at: string | null;
  work_done_at: string | null;
  ready_at: string | null;
  gate_pass_issued_at: string | null;
  delivered_at: string | null;
}

/** Full-detail query for reports — includes all timestamp columns */
export async function getVehiclesForReport(
  companyId: string,
  options?: {
    branchId?: string | null;
    shopType?: ShopType | null;
    fromDate?: string | null;
    toDate?: string | null;
  }
): Promise<VehicleReportRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("vehicle_register")
    .select(`
      id, model, registration_number, customer_name, shop_type, status, ro_number,
      is_insurance_claim,
      arrived_at, ro_opened_at, insurance_approved_at,
      work_started_at, work_done_at, ready_at,
      gate_pass_issued_at, delivered_at
    `)
    .eq("company_id", companyId)
    .order("arrived_at", { ascending: false });

  if (options?.branchId) query = query.eq("branch_id", options.branchId);
  if (options?.shopType) query = query.eq("shop_type", options.shopType);
  if (options?.fromDate) query = query.gte("arrived_at", options.fromDate);
  if (options?.toDate) query = query.lte("arrived_at", `${options.toDate}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getVehicles(
  companyId: string,
  branchId?: string | null,
  shopType?: ShopType | null,
  status?: VehicleStatus | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("vehicle_register")
    .select(`
      id, model, registration_number, customer_name, shop_type, status,
      arrived_at, ro_opened_at, work_started_at, work_done_at, ready_at,
      gate_pass_issued_at, delivered_at, is_insurance_claim, notes
    `)
    .eq("company_id", companyId)
    .order("arrived_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (shopType) query = query.eq("shop_type", shopType);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getVehicle(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_register")
    .select(`
      *,
      invoice:invoices!vehicle_register_invoice_id_fkey(
        id, dms_invoice_number, grand_total, delivery_challan_number, delivery_challan_date, approval_status
      )
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getVehicleComments(vehicleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_job_comments")
    .select(`
      id, comment, created_at,
      author:user_profiles!vehicle_job_comments_created_by_fkey(full_name)
    `)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addVehicleComment(
  vehicleId: string,
  comment: string,
  createdBy: string
): Promise<{ success?: boolean; error?: string }> {
  if (!comment.trim()) return { error: "Comment cannot be empty." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_job_comments")
    .insert({ vehicle_id: vehicleId, comment: comment.trim(), created_by: createdBy });

  if (error) return { error: error.message };
  revalidatePath(`/sales/vehicle-register/${vehicleId}`);
  return { success: true };
}

export async function createVehicle(values: CreateVehicleValues) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_register")
    .insert({
      company_id: values.company_id,
      branch_id: values.branch_id,
      financial_year_id: values.financial_year_id || null,
      shop_type: values.shop_type,
      model: values.model,
      registration_number: values.registration_number || null,
      customer_name: values.customer_name || null,
      notes: values.notes || null,
      created_by: values.created_by,
      status: "arrived",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  return { success: true, id: data.id };
}

/** Advance a vehicle to the next workshop status with timestamp tracking */
export async function updateVehicleStatus(
  vehicleId: string,
  newStatus: VehicleStatus,
  extra?: { ro_number?: string }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const tsMap: Partial<Record<VehicleStatus, string>> = {
    ro_opened: "ro_opened_at",
    work_in_progress: "work_started_at",
    insurance_approved: "insurance_approved_at",
    work_done: "work_done_at",
    ready_for_delivery: "ready_at",
    gate_pass_issued: "gate_pass_issued_at",
    delivered: "delivered_at",
  };

  const tsField = tsMap[newStatus];
  const update: Record<string, unknown> = { status: newStatus };
  if (tsField) update[tsField] = now;
  if (extra?.ro_number) update.ro_number = extra.ro_number;

  const { error } = await supabase
    .from("vehicle_register")
    .update(update)
    .eq("id", vehicleId);

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  revalidatePath(`/sales/vehicle-register/${vehicleId}`);
  return { success: true };
}

/** Called when a gate pass is issued for an invoice — auto-updates vehicle status */
export async function markVehicleChallanIssued(invoiceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_register")
    .update({
      status: "gate_pass_issued",
      gate_pass_issued_at: new Date().toISOString(),
      // keep legacy column in sync
      challan_issued_at: new Date().toISOString(),
    })
    .eq("invoice_id", invoiceId)
    .not("status", "in", '("delivered")'); // idempotent; don't downgrade

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  return { success: true };
}

/** Mark a vehicle as delivered */
export async function markVehicleDelivered(
  vehicleId: string,
  notes?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicle_register")
    .select("status")
    .eq("id", vehicleId)
    .single();

  if (!vehicle) return { error: "Vehicle not found." };
  // Allow delivery from gate_pass_issued or ready_for_delivery
  if (!["gate_pass_issued", "ready_for_delivery", "challan_issued"].includes(vehicle.status)) {
    return { error: "Vehicle must have a gate pass issued or be ready for delivery first." };
  }

  const { error } = await supabase
    .from("vehicle_register")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    })
    .eq("id", vehicleId);

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  revalidatePath(`/sales/vehicle-register/${vehicleId}`);
  return { success: true };
}

/** Link a vehicle to an invoice (legacy sales flow — marks as 'billed') */
export async function linkVehicleToInvoice(vehicleId: string, invoiceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_register")
    .update({
      invoice_id: invoiceId,
      status: "billed",
      billed_at: new Date().toISOString(),
    })
    .eq("id", vehicleId)
    .eq("status", "arrived");

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  return { success: true };
}
