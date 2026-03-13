"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  customFieldSchema,
  type CustomFieldFormValues,
} from "@/lib/validators/custom-field";

export async function getCustomFields(
  companyId: string,
  entityType?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("company_id", companyId)
    .order("entity_type")
    .order("display_order");

  if (entityType) query = query.eq("entity_type", entityType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCustomField(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCustomField(
  values: CustomFieldFormValues & { company_id: string }
) {
  const validated = customFieldSchema.parse(values);
  const supabase = await createClient();

  const dropdownOptions =
    validated.field_type === "dropdown" && validated.dropdown_options
      ? validated.dropdown_options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  const { error } = await supabase.from("custom_field_definitions").insert({
    company_id: values.company_id,
    entity_type: validated.entity_type,
    field_name: validated.field_name,
    field_label: validated.field_label,
    field_type: validated.field_type,
    dropdown_options: dropdownOptions,
    is_mandatory: validated.is_mandatory,
    is_active: true,
    display_order: validated.display_order,
  });

  if (error) return { error: error.message };
  revalidatePath("/settings/custom-fields");
  return { success: true };
}

export async function updateCustomField(
  id: string,
  values: CustomFieldFormValues
) {
  const validated = customFieldSchema.parse(values);
  const supabase = await createClient();

  const dropdownOptions =
    validated.field_type === "dropdown" && validated.dropdown_options
      ? validated.dropdown_options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  const { error } = await supabase
    .from("custom_field_definitions")
    .update({
      entity_type: validated.entity_type,
      field_name: validated.field_name,
      field_label: validated.field_label,
      field_type: validated.field_type,
      dropdown_options: dropdownOptions,
      is_mandatory: validated.is_mandatory,
      display_order: validated.display_order,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/settings/custom-fields");
  return { success: true };
}

export async function toggleCustomField(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_field_definitions")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/settings/custom-fields");
  return { success: true };
}
