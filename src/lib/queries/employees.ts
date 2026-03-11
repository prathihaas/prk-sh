"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validators/employee";

export async function getEmployees(companyId: string, branchId?: string | null, status?: string) {
  const supabase = await createClient();
  let query = supabase.from("employees").select("*").eq("company_id", companyId).order("full_name");
  if (branchId) query = query.eq("branch_id", branchId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getEmployee(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createEmployee(values: EmployeeFormValues & { company_id: string; branch_id: string }) {
  const validated = employeeSchema.parse(values);
  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    ...validated, designation: validated.designation || null, department: validated.department || null,
    bank_name: validated.bank_name || null, bank_account_number: validated.bank_account_number || null,
    bank_ifsc: validated.bank_ifsc || null, exit_date: validated.exit_date || null,
    company_id: values.company_id, branch_id: values.branch_id,
  });
  if (error) {
    if (error.code === "23505") return { error: "An employee with this code already exists." };
    return { error: error.message };
  }
  revalidatePath("/hr/employees");
  return { success: true };
}

export async function updateEmployee(id: string, values: EmployeeFormValues) {
  const validated = employeeSchema.parse(values);
  const supabase = await createClient();
  const { error } = await supabase.from("employees").update({
    ...validated, designation: validated.designation || null, department: validated.department || null,
    bank_name: validated.bank_name || null, bank_account_number: validated.bank_account_number || null,
    bank_ifsc: validated.bank_ifsc || null, exit_date: validated.exit_date || null,
  }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "An employee with this code already exists." };
    return { error: error.message };
  }
  revalidatePath("/hr/employees");
  return { success: true };
}
