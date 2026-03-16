"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VehicleStatus = "arrived" | "billed" | "challan_issued" | "delivered";

export interface CreateVehicleValues {
  company_id: string;
  branch_id: string;
  financial_year_id?: string;
  vehicle_type: string;
  make?: string;
  model: string;
  variant?: string;
  color?: string;
  year_of_manufacture?: number;
  vin_number?: string;
  chassis_number?: string;
  engine_number?: string;
  registration_number?: string;
  customer_id?: string;
  customer_name?: string;
  expected_delivery_date?: string;
  notes?: string;
  created_by: string;
}

export async function getVehicles(
  companyId: string,
  branchId?: string | null,
  status?: VehicleStatus | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("vehicle_register")
    .select(`
      *,
      customer:customers!vehicle_register_customer_id_fkey(id, full_name, phone),
      invoice:invoices!vehicle_register_invoice_id_fkey(id, dms_invoice_number, grand_total)
    `)
    .eq("company_id", companyId)
    .order("arrived_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
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
      customer:customers!vehicle_register_customer_id_fkey(id, full_name, phone, address, city, state),
      invoice:invoices!vehicle_register_invoice_id_fkey(id, dms_invoice_number, grand_total, delivery_challan_number, delivery_challan_date, approval_status)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createVehicle(values: CreateVehicleValues) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_register")
    .insert({
      company_id: values.company_id,
      branch_id: values.branch_id,
      financial_year_id: values.financial_year_id || null,
      vehicle_type: values.vehicle_type,
      make: values.make || null,
      model: values.model,
      variant: values.variant || null,
      color: values.color || null,
      year_of_manufacture: values.year_of_manufacture || null,
      vin_number: values.vin_number || null,
      chassis_number: values.chassis_number || null,
      engine_number: values.engine_number || null,
      registration_number: values.registration_number || null,
      customer_id: values.customer_id || null,
      customer_name: values.customer_name || null,
      expected_delivery_date: values.expected_delivery_date || null,
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

export async function updateVehicle(
  id: string,
  values: Partial<Omit<CreateVehicleValues, "company_id" | "branch_id" | "created_by">> & {
    delay_reason?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_register")
    .update({
      vehicle_type: values.vehicle_type,
      make: values.make || null,
      model: values.model,
      variant: values.variant || null,
      color: values.color || null,
      year_of_manufacture: values.year_of_manufacture || null,
      vin_number: values.vin_number || null,
      chassis_number: values.chassis_number || null,
      engine_number: values.engine_number || null,
      registration_number: values.registration_number || null,
      customer_id: values.customer_id || null,
      customer_name: values.customer_name || null,
      expected_delivery_date: values.expected_delivery_date || null,
      notes: values.notes || null,
      delay_reason: values.delay_reason || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  revalidatePath(`/sales/vehicle-register/${id}`);
  return { success: true };
}

/** Link a vehicle to an invoice — marks status as 'billed' */
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
    .eq("status", "arrived"); // Only link if still in 'arrived' state

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  return { success: true };
}

/** Called when a delivery challan is issued for an invoice — auto-updates vehicle status */
export async function markVehicleChallanIssued(invoiceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_register")
    .update({
      status: "challan_issued",
      challan_issued_at: new Date().toISOString(),
    })
    .eq("invoice_id", invoiceId)
    .in("status", ["arrived", "billed"]); // idempotent

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  return { success: true };
}

/** Mark a vehicle as physically delivered (after challan has been issued) */
export async function markVehicleDelivered(vehicleId: string, reason?: string) {
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicle_register")
    .select("status, invoice_id")
    .eq("id", vehicleId)
    .single();

  if (!vehicle) return { error: "Vehicle not found." };
  if (vehicle.status !== "challan_issued") {
    return { error: "A delivery challan must be issued before marking the vehicle as delivered." };
  }

  const { error } = await supabase
    .from("vehicle_register")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      ...(reason ? { delay_reason: reason } : {}),
    })
    .eq("id", vehicleId);

  if (error) return { error: error.message };
  revalidatePath("/sales/vehicle-register");
  revalidatePath(`/sales/vehicle-register/${vehicleId}`);
  return { success: true };
}
