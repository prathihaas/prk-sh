"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { expenseCategorySchema, type ExpenseCategoryFormValues } from "@/lib/validators/expense-category";

export async function getExpenseCategories(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function getExpenseCategory(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createExpenseCategory(
  values: ExpenseCategoryFormValues & { company_id: string }
) {
  const validated = expenseCategorySchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("expense_categories").insert({
    name: validated.name,
    budget_limit: validated.budget_limit ?? null,
    is_active: validated.is_active,
    company_id: values.company_id,
  });

  if (error) {
    if (error.code === "23505") return { error: "A category with this name already exists." };
    return { error: error.message };
  }

  revalidatePath("/expenses/categories");
  return { success: true };
}

export async function updateExpenseCategory(id: string, values: ExpenseCategoryFormValues) {
  const validated = expenseCategorySchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("expense_categories")
    .update({
      name: validated.name,
      budget_limit: validated.budget_limit ?? null,
      is_active: validated.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "A category with this name already exists." };
    return { error: error.message };
  }

  revalidatePath("/expenses/categories");
  return { success: true };
}
