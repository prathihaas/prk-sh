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

/** Default expense categories seeded for every new company. */
const DEFAULT_EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Travel",
  "Fuel",
  "Repairs & Maintenance",
  "Utilities",
  "Rent",
  "Salaries & Wages",
  "Insurance",
  "Bank Charges",
  "Telephone & Internet",
  "Printing & Stationery",
  "Miscellaneous",
];

/**
 * Compute the current Indian financial year (Apr 1 → Mar 31) for a given date.
 * E.g. for 2026-04-30 → { label: "2026-27", start_date: "2026-04-01", end_date: "2027-03-31" }
 */
function currentIndianFinancialYear(today: Date = new Date()): {
  label: string;
  start_date: string;
  end_date: string;
} {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0 = January
  const startYear = m >= 3 ? y : y - 1; // April or later → this year, else previous
  const endYear = startYear + 1;
  const yy = (n: number) => String(n).slice(-2);
  return {
    label: `${startYear}-${yy(endYear)}`,
    start_date: `${startYear}-04-01`,
    end_date: `${endYear}-03-31`,
  };
}

export async function createCompany(values: CompanyFormValues & { group_id: string }) {
  const validated = companySchema.parse(values);
  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("companies")
    .insert({
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
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return { error: "A company with this code already exists in your group." };
    }
    return { error: error?.message || "Failed to create company" };
  }

  const companyId = created.id as string;

  // ── Seed initial data so users assigned to this company immediately have
  //    something to work with. Without these, expense / payment / transaction
  //    forms would all show empty dropdowns and feel broken.

  // 1) Active financial year (current Indian FY: Apr 1 → Mar 31)
  const fy = currentIndianFinancialYear();
  const { error: fyError } = await supabase.from("financial_years").insert({
    company_id: companyId,
    label: fy.label,
    start_date: fy.start_date,
    end_date: fy.end_date,
  });
  if (fyError) {
    console.error("[createCompany] failed to seed financial year:", fyError.message);
  }

  // 2) Default expense categories
  const { error: catError } = await supabase.from("expense_categories").insert(
    DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      company_id: companyId,
      name,
      is_active: true,
    }))
  );
  if (catError) {
    console.error("[createCompany] failed to seed expense categories:", catError.message);
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
