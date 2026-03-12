"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { customerSchema, type CustomerFormValues } from "@/lib/validators/customer";

export async function getCustomers(
  companyId: string,
  branchId?: string | null,
  filters?: { search?: string; customer_type?: string; is_active?: boolean }
) {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .order("customer_code", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.customer_type) query = query.eq("customer_type", filters.customer_type);
  if (filters?.is_active !== undefined) query = query.eq("is_active", filters.is_active);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCustomer(
  values: CustomerFormValues & {
    company_id: string;
    branch_id?: string | null;
    created_by: string;
  }
) {
  const validated = customerSchema.parse(values);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      full_name: validated.full_name,
      phone: validated.phone || null,
      email: validated.email || null,
      customer_type: validated.customer_type,
      address: validated.address || null,
      city: validated.city || null,
      state: validated.state || null,
      pincode: validated.pincode || null,
      gstin: validated.gstin || null,
      pan: validated.pan || null,
      notes: validated.notes || null,
      is_active: validated.is_active,
      company_id: values.company_id,
      branch_id: values.branch_id || null,
      created_by: values.created_by,
    })
    .select("id, customer_code")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/sales/customers");
  return { success: true, id: data.id, customer_code: data.customer_code };
}

export async function updateCustomer(id: string, values: CustomerFormValues) {
  const validated = customerSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: validated.full_name,
      phone: validated.phone || null,
      email: validated.email || null,
      customer_type: validated.customer_type,
      address: validated.address || null,
      city: validated.city || null,
      state: validated.state || null,
      pincode: validated.pincode || null,
      gstin: validated.gstin || null,
      pan: validated.pan || null,
      notes: validated.notes || null,
      is_active: validated.is_active,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${id}`);
  return { success: true };
}

export async function toggleCustomerActive(id: string, is_active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/sales/customers");
  return { success: true };
}
