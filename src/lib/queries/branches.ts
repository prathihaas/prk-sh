"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { branchSchema, type BranchFormValues } from "@/lib/validators/branch";

export async function getBranches(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*, manager:user_profiles!fk_branches_manager(full_name)")
    .eq("company_id", companyId)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function getBranch(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createBranch(
  values: BranchFormValues & { company_id: string }
) {
  const validated = branchSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("branches").insert({
    company_id: values.company_id,
    name: validated.name,
    code: validated.code,
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
      return { error: "A branch with this code already exists in this company." };
    }
    return { error: error.message };
  }

  // Branches feed dropdowns across user creation, telegram settings, scope
  // switcher, etc. Invalidate broadly so all server components refetch.
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateBranch(id: string, values: BranchFormValues) {
  const validated = branchSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("branches")
    .update({
      name: validated.name,
      code: validated.code,
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
