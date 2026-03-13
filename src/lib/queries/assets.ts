"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const assetCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().or(z.literal("")),
});

export const assetSchema = z.object({
  asset_code: z.string().min(1, "Asset code is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  is_vehicle: z.boolean(),
  purchase_date: z.string().optional().or(z.literal("")),
  purchase_value: z.number().min(0).optional(),
  useful_life_years: z.number().int().min(1).max(99).optional(),
  salvage_value: z.number().min(0).optional(),
  branch_id: z.string().uuid().optional().or(z.literal("")),
});

export async function getAssets(companyId: string, branchId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("assets")
    .select(
      "id, asset_code, qr_token, name, is_vehicle, status, current_km_reading, purchase_value, useful_life_years, purchase_date, last_audit_date, audit_condition, category:asset_categories(name), assigned_employee:employees(id, name)"
    )
    .eq("company_id", companyId)
    .order("asset_code");

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAsset(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "*, category:asset_categories(id, name), assigned_employee:employees(id, name, employee_code)"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAssetByQrToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("id")
    .eq("qr_token", token)
    .single();
  if (error) return null;
  return data;
}

export async function getAssetHistory(assetId: string) {
  const supabase = await createClient();
  const [kmRes, auditRes, assignRes] = await Promise.all([
    supabase
      .from("asset_km_readings")
      .select("id, reading_date, km_reading, notes, recorded_by")
      .eq("asset_id", assetId)
      .order("reading_date", { ascending: false })
      .limit(50),
    supabase
      .from("asset_audits")
      .select("id, audited_at, condition, km_reading, notes, audited_by")
      .eq("asset_id", assetId)
      .order("audited_at", { ascending: false })
      .limit(50),
    supabase
      .from("asset_assignments")
      .select("id, assigned_at, returned_at, notes, employee:employees(id, name, employee_code)")
      .eq("asset_id", assetId)
      .order("assigned_at", { ascending: false })
      .limit(50),
  ]);
  return {
    kmReadings: kmRes.data || [],
    audits: auditRes.data || [],
    assignments: assignRes.data || [],
  };
}

export async function getAssetCategories(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_categories")
    .select("id, name, description, is_active")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createAssetCategory(values: { company_id: string; name: string; description?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("asset_categories").insert({
    company_id: values.company_id,
    name: values.name,
    description: values.description || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/assets/categories");
  return { success: true };
}

export async function createAsset(values: z.infer<typeof assetSchema> & { company_id: string; created_by: string }) {
  const validated = assetSchema.parse(values);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert({
      company_id: values.company_id,
      branch_id: validated.branch_id || null,
      asset_code: validated.asset_code,
      name: validated.name,
      description: validated.description || null,
      category_id: validated.category_id || null,
      is_vehicle: validated.is_vehicle,
      purchase_date: validated.purchase_date || null,
      purchase_value: validated.purchase_value ?? null,
      useful_life_years: validated.useful_life_years ?? null,
      salvage_value: validated.salvage_value ?? 0,
      created_by: values.created_by,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/assets");
  return { success: true, id: data.id };
}

export async function updateAsset(id: string, values: z.infer<typeof assetSchema>) {
  const validated = assetSchema.parse(values);
  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({
      branch_id: validated.branch_id || null,
      asset_code: validated.asset_code,
      name: validated.name,
      description: validated.description || null,
      category_id: validated.category_id || null,
      is_vehicle: validated.is_vehicle,
      purchase_date: validated.purchase_date || null,
      purchase_value: validated.purchase_value ?? null,
      useful_life_years: validated.useful_life_years ?? null,
      salvage_value: validated.salvage_value ?? 0,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { success: true };
}

export async function recordKmReading(values: {
  asset_id: string;
  reading_date: string;
  km_reading: number;
  notes?: string;
  recorded_by: string;
}) {
  const supabase = await createClient();
  const { error: kmError } = await supabase.from("asset_km_readings").insert({
    asset_id: values.asset_id,
    reading_date: values.reading_date,
    km_reading: values.km_reading,
    notes: values.notes || null,
    recorded_by: values.recorded_by,
  });
  if (kmError) return { error: kmError.message };

  const { error: updateError } = await supabase
    .from("assets")
    .update({ current_km_reading: values.km_reading })
    .eq("id", values.asset_id);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/assets/${values.asset_id}`);
  return { success: true };
}

export async function recordAssetAudit(values: {
  asset_id: string;
  condition: string;
  km_reading?: number;
  notes?: string;
  audited_by: string;
}) {
  const supabase = await createClient();
  const { error: auditError } = await supabase.from("asset_audits").insert({
    asset_id: values.asset_id,
    condition: values.condition,
    km_reading: values.km_reading || null,
    notes: values.notes || null,
    audited_by: values.audited_by,
  });
  if (auditError) return { error: auditError.message };

  const { error: updateError } = await supabase
    .from("assets")
    .update({
      last_audit_date: new Date().toISOString().split("T")[0],
      last_audit_by: values.audited_by,
      audit_condition: values.condition,
      ...(values.km_reading ? { current_km_reading: values.km_reading } : {}),
    })
    .eq("id", values.asset_id);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/assets/${values.asset_id}`);
  return { success: true };
}

export async function assignAsset(values: {
  asset_id: string;
  employee_id: string | null;
  notes?: string;
  assigned_by: string;
}) {
  const supabase = await createClient();
  // Close any open assignment
  await supabase
    .from("asset_assignments")
    .update({ returned_at: new Date().toISOString() })
    .eq("asset_id", values.asset_id)
    .is("returned_at", null);

  if (values.employee_id) {
    const { error } = await supabase.from("asset_assignments").insert({
      asset_id: values.asset_id,
      employee_id: values.employee_id,
      notes: values.notes || null,
      assigned_by: values.assigned_by,
    });
    if (error) return { error: error.message };
  }

  const { error: updateError } = await supabase
    .from("assets")
    .update({
      assigned_to: values.employee_id || null,
      assigned_at: values.employee_id ? new Date().toISOString() : null,
    })
    .eq("id", values.asset_id);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/assets/${values.asset_id}`);
  return { success: true };
}

export async function updateAssetStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { success: true };
}
