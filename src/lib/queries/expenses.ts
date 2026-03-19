"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  expenseSchema,
  type ExpenseFormValues,
  expensePaymentSchema,
  type ExpensePaymentFormValues,
} from "@/lib/validators/expense";
import { getCashLimits } from "@/lib/queries/company-configs";

/**
 * Get a single expense with full context for the printable voucher view:
 * expense + category + submitter profile + paid_via cashbook + company + branch
 */
export async function getExpenseWithContext(id: string) {
  const supabase = await createClient();

  const { data: expense, error } = await supabase
    .from("expenses")
    .select(
      `*,
       category:expense_categories(name),
       submitter:user_profiles!expenses_submitted_by_fkey(full_name, email),
       cashbook:cashbooks!expenses_paid_via_cashbook_id_fkey(name),
       branch_approver:user_profiles!expenses_branch_approved_by_fkey(full_name),
       accounts_approver:user_profiles!expenses_accounts_approved_by_fkey(full_name),
       owner_approver:user_profiles!expenses_owner_approved_by_fkey(full_name)`
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  // Get company and branch
  const { data: company } = await supabase
    .from("companies")
    .select("name, gstin, address, pan, logo_url")
    .eq("id", expense.company_id)
    .single();

  const branchResult = expense.branch_id
    ? await supabase
        .from("branches")
        .select("name, address, phone")
        .eq("id", expense.branch_id)
        .single()
    : { data: null };

  return { expense, company, branch: branchResult.data };
}

export async function getExpenses(
  companyId: string,
  branchId?: string | null,
  filters?: { status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("*, category:expense_categories(name)")
    .eq("company_id", companyId)
    .order("expense_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.status) query = query.eq("approval_status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getExpense(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*, category:expense_categories(name)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createExpense(
  values: ExpenseFormValues & {
    company_id: string;
    branch_id: string;
    submitted_by: string;
    financial_year_id: string;
  }
) {
  const validated = expenseSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase.from("expenses").insert({
    category_id: validated.category_id,
    expense_date: validated.expense_date,
    amount: validated.amount,
    description: validated.description,
    bill_reference: validated.bill_reference || null,
    notes: validated.notes || null,
    company_id: values.company_id,
    branch_id: values.branch_id,
    submitted_by: values.submitted_by,
    financial_year_id: values.financial_year_id,
    approval_status: "draft",
  });

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

export async function updateExpense(id: string, values: ExpenseFormValues) {
  const validated = expenseSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .update({
      category_id: validated.category_id,
      expense_date: validated.expense_date,
      amount: validated.amount,
      description: validated.description,
      bill_reference: validated.bill_reference || null,
      notes: validated.notes || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

export async function submitExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ approval_status: "submitted" })
    .eq("id", id)
    .in("approval_status", ["draft"]);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

export async function approveExpenseBranch(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("expenses")
    .update({
      approval_status: "branch_approved",
      branch_approved_by: user.id,
      branch_approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("approval_status", ["submitted"]);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

export async function approveExpenseAccounts(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("expenses")
    .update({
      approval_status: "accounts_approved",
      accounts_approved_by: user.id,
      accounts_approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("approval_status", ["branch_approved"]);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

export async function approveExpenseOwner(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("expenses")
    .update({
      approval_status: "owner_approved",
      owner_approved_by: user.id,
      owner_approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("approval_status", ["accounts_approved"]);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

export async function rejectExpense(id: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ approval_status: "rejected", rejection_reason: reason })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true };
}

/**
 * Pay an approved expense through a cashbook.
 * Creates a payment transaction in the cashbook and marks the expense as paid.
 * Validates that the payment_date has an open cashbook day.
 * If bypass_approval is true (cashier direct payment), records it as paid_without_approval.
 */
export async function payExpense(
  expenseId: string,
  values: ExpensePaymentFormValues & {
    company_id: string;
    branch_id: string;
    paid_by: string;
    financial_year_id?: string;
    bypass_approval?: boolean;
  }
) {
  const validated = expensePaymentSchema.parse(values);
  const supabase = await createClient();

  // Get the expense details
  const { data: expense, error: expError } = await supabase
    .from("expenses")
    .select("*, category:expense_categories(name)")
    .eq("id", expenseId)
    .single();

  if (expError || !expense) {
    return { error: "Expense not found" };
  }

  // If not bypassing approval, require full approval
  if (!values.bypass_approval && expense.approval_status !== "owner_approved") {
    return { error: "Expense must be fully approved (owner_approved) before payment. Cashiers can use 'Pay Directly' to bypass approval." };
  }

  if (expense.payment_date) {
    return { error: "This expense has already been paid." };
  }

  // ── Cash limit enforcement (Section 40A(3)) ──────────────────────────────
  if (validated.payment_mode === "cash") {
    const limits = await getCashLimits(values.company_id);
    if (expense.amount > limits.expense_cash_per_payment) {
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
      return {
        error: `Cash payment blocked (Section 40A(3)): The expense amount of ${fmt(expense.amount)} exceeds the cash payment limit of ${fmt(limits.expense_cash_per_payment)} per payment. Use a non-cash payment mode (cheque, bank transfer, UPI) to comply with the Income Tax Act.`,
      };
    }
  }

  // Find an open/reopened day for this cashbook + payment date
  const { data: day, error: dayError } = await supabase
    .from("cashbook_days")
    .select("id, status")
    .eq("cashbook_id", validated.cashbook_id)
    .eq("date", validated.payment_date)
    .in("status", ["open", "reopened"])
    .single();

  if (dayError || !day) {
    return {
      error:
        "No open cashbook day found for this payment date. The day may be closed or does not exist yet. Please open the day first from the Cashbooks section.",
    };
  }

  // Create a payment transaction in the cashbook
  const categoryName = expense.category?.name || "Expense";
  const bypassNote = values.bypass_approval ? " [PAID WITHOUT APPROVAL]" : "";
  const narration = `Expense Payment: ${categoryName} - ${expense.description}${bypassNote}`;

  const { error: txnError } = await supabase.from("cashbook_transactions").insert({
    cashbook_id: validated.cashbook_id,
    cashbook_day_id: day.id,
    company_id: values.company_id,
    branch_id: values.branch_id,
    financial_year_id: values.financial_year_id || null,
    txn_type: "payment",
    amount: expense.amount,
    payment_mode: validated.payment_mode,
    narration,
    party_name: categoryName,
    receipt_number: "PENDING",
    receipt_hash: "PENDING",
    created_by: values.paid_by,
    reference_type: "expense",
    reference_id: expenseId,
  });

  if (txnError) return { error: txnError.message };

  // Mark expense as paid
  // - "paid_direct" = cashier bypassed approval (no owner_approved)
  // - "paid" = fully approved then paid normally
  const newStatus = values.bypass_approval ? "paid_direct" : "paid";
  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      payment_date: validated.payment_date,
      paid_via_cashbook_id: validated.cashbook_id,
      payment_mode: validated.payment_mode,
      paid_by: values.paid_by,
      approval_status: newStatus,
    })
    .eq("id", expenseId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/expenses");
  revalidatePath("/expenses/unapproved-payments");
  revalidatePath("/cash/cashbooks");
  return { success: true };
}

/**
 * Get expenses paid directly by cashiers without full approval.
 * These are expenses with approval_status = "paid_direct" — set when
 * a cashier uses the bypass_approval flag to pay without going through
 * the full owner_approved workflow.
 */
export async function getUnapprovedPayments(
  companyId: string,
  branchId?: string | null
) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(`
      *,
      category:expense_categories(name),
      cashbook:cashbooks!expenses_paid_via_cashbook_id_fkey(id, name),
      submitter:user_profiles!expenses_submitted_by_fkey(id, full_name, email),
      payer:user_profiles!expenses_paid_by_fkey(id, full_name, email)
    `)
    .eq("company_id", companyId)
    .eq("approval_status", "paid_direct") // specifically paid without approval
    .order("payment_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get all expenses with submitter, approver user names for the expenses list.
 */
export async function getExpensesWithUsers(
  companyId: string,
  branchId?: string | null,
  filters?: { status?: string }
) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(`
      *,
      category:expense_categories(name),
      submitter:user_profiles!expenses_submitted_by_fkey(id, full_name, email),
      payer:user_profiles!expenses_paid_by_fkey(id, full_name, email)
    `)
    .eq("company_id", companyId)
    .order("expense_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (filters?.status) query = query.eq("approval_status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
