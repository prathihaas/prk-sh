"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { companySchema, type CompanyFormValues } from "@/lib/validators/company";

export async function getCompanies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function getCompany(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCompany(values: CompanyFormValues & { group_id: string }) {
  const validated = companySchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("companies").insert({
    group_id: values.group_id,
    name: validated.name,
    code: validated.code,
    legal_name: validated.legal_name || null,
    gstin: validated.gstin || null,
    pan: validated.pan || null,
    address: {
      line1: validated.address_line1 || "",
      line2: validated.address_line2 || "",
      city: validated.city || "",
      state: validated.state || "",
      pincode: validated.pincode || "",
    },
    is_active: validated.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A company with this code already exists in your group." };
    }
    return { error: error.message };
  }

  // A new company affects company/branch dropdowns across many pages
  // (user creation, settings, telegram, scope switcher, etc.). Invalidate
  // the entire dashboard layout so all server components refetch their
  // company-scoped data on next navigation.
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateCompany(id: string, values: CompanyFormValues) {
  const validated = companySchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name: validated.name,
      code: validated.code,
      legal_name: validated.legal_name || null,
      gstin: validated.gstin || null,
      pan: validated.pan || null,
      address: {
        line1: validated.address_line1 || "",
        line2: validated.address_line2 || "",
        city: validated.city || "",
        state: validated.state || "",
        pincode: validated.pincode || "",
      },
      is_active: validated.is_active,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
