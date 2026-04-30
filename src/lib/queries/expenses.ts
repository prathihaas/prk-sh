"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  expenseSchema,
  type ExpenseFormValues,
  expensePaymentSchema,
  type ExpensePaymentFormValues,
} from "@/lib/validators/expense";
import { resolveOrCreateCashbookDay } from "@/lib/queries/cashbook-days";
import { getCashLimits, getTelegramBotToken } from "@/lib/queries/company-configs";
import { sendExpenseApprovalRequest } from "@/lib/utils/telegram-notify";
import {
  getEligibleExpenseApprovers,
  isUserEligibleExpenseApprover,
} from "@/lib/queries/expense-approvers";

// ── Internal: Notify the branch manager via Telegram ────────────────────────
//
// Approval is single-stage and any eligible approver (owner / finance / accounts
// / branch manager) can approve in the app. To keep Telegram quiet for the
// senior roles, the *Telegram* notification goes only to the branch manager
// of the expense's branch — they're the day-to-day operational gatekeeper.
// Senior approvers can still review and act from the in-app /approvals inbox.

async function notifyExpenseApprovers(
  expenseId: string,
  companyId: string,
  branchId: string | null
): Promise<void> {
  try {
    const supabase = await createClient();

    const [botToken, approvers] = await Promise.all([
      getTelegramBotToken(companyId),
      getEligibleExpenseApprovers(supabase, companyId, branchId),
    ]);

    if (!botToken) return;
    const chatIds = approvers
      .filter((a) => a.role_name === "branch_manager")
      .map((a) => a.telegram_chat_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (chatIds.length === 0) return;

    const { data: expense } = await supabase
      .from("expenses")
      .select(`
        id, amount, description, expense_date, company_id, branch_id,
        category:expense_categories(name),
        submitter:user_profiles!expenses_submitted_by_fkey(full_name)
      `)
      .eq("id", expenseId)
      .maybeSingle();

    if (!expense) return;

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    let branchName: string | undefined;
    if (expense.branch_id) {
      const { data: branch } = await supabase
        .from("branches")
        .select("name")
        .eq("id", expense.branch_id)
        .maybeSingle();
      branchName = branch?.name;
    }

    const categoryName = (expense.category as { name?: string } | null)?.name || "Expense";
    const submitterName = (expense.submitter as { full_name?: string } | null)?.full_name || "Unknown";

    const payload = {
      expenseId: expense.id,
      amount: expense.amount,
      description: expense.description,
      categoryName,
      expenseDate: expense.expense_date,
      submitterName,
      companyName: company?.name,
      branchName,
    };

    await Promise.all(
      chatIds.map((chatId: string) =>
        sendExpenseApprovalRequest(payload, botToken, chatId).catch((err: unknown) => {
          console.error(`[telegram] failed for chat ${chatId}:`, err);
        })
      )
    );
  } catch (err) {
    console.error("[telegram] notifyExpenseApprovers error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

  const { data, error } = await supabase
    .from("expenses")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: true, id: data?.id as string };
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
  const { data: expense, error: fetchErr } = await supabase
    .from("expenses")
    .select("company_id, branch_id, approval_status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !expense) return { error: fetchErr?.message || "Expense not found" };

  const { error } = await supabase
    .from("expenses")
    .update({ approval_status: "submitted" })
    .eq("id", id)
    .in("approval_status", ["draft"]);

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/approvals");

  // Notify all eligible approvers (fire-and-forget)
  if (expense.company_id) {
    void notifyExpenseApprovers(id, expense.company_id, expense.branch_id ?? null);
  }

  return { success: true };
}

/**
 * Approve an expense in a single step.
 *
 * Eligibility: caller must be (in this expense's company)
 *   - any user with role owner / group_finance_controller / company_accountant, OR
 *   - a branch_manager whose assignment covers this expense's branch.
 *
 * The submitter is never allowed to approve their own expense.
 *
 * On approval, the expense moves to "owner_approved" — the existing
 * pre-payment terminal state — and the approver is recorded in
 * owner_approved_by/at for audit. (We reuse the existing column rather
 * than introducing a new one to avoid an enum + schema migration.)
 */
export async function approveExpense(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: expense, error: fetchErr } = await supabase
    .from("expenses")
    .select("company_id, branch_id, approval_status, submitted_by")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !expense) return { error: fetchErr?.message || "Expense not found" };
  if (expense.approval_status !== "submitted") {
    return { error: "Only submitted expenses can be approved." };
  }
  if (!expense.company_id) return { error: "Expense missing company scope" };
  if (expense.submitted_by === user.id) {
    return { error: "You cannot approve an expense you submitted yourself." };
  }

  const eligible = await isUserEligibleExpenseApprover(
    supabase,
    user.id,
    expense.company_id,
    expense.branch_id ?? null
  );
  if (!eligible) {
    return {
      error:
        "You are not authorised to approve this expense. Only owners, finance controllers, accountants, or this branch's manager can approve.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("expenses")
    .update({
      approval_status: "owner_approved",
      owner_approved_by: user.id,
      owner_approved_at: now,
      // mirror to legacy stage columns for any downstream report that reads them
      branch_approved_by: user.id,
      branch_approved_at: now,
      accounts_approved_by: user.id,
      accounts_approved_at: now,
    })
    .eq("id", id)
    .eq("approval_status", "submitted");

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/approvals");
  return { success: true };
}

// ── Backwards-compatibility shims ────────────────────────────────────────
// Old callers (UI buttons, telegram webhooks) used three stage-specific
// approval actions. They all now collapse into the single approveExpense.
export async function approveExpenseBranch(id: string) {
  return approveExpense(id);
}
export async function approveExpenseAccounts(id: string) {
  return approveExpense(id);
}
export async function approveExpenseOwner(id: string) {
  return approveExpense(id);
}

export async function rejectExpense(id: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!reason || reason.trim().length === 0) {
    return { error: "Rejection reason is required" };
  }

  // Only allow rejection from an actionable (pending) state. Prevents re-rejecting
  // paid/already-rejected expenses and prevents race conditions where a stale
  // approval request fires after a reject/approve.
  const { data: updated, error } = await supabase
    .from("expenses")
    .update({
      approval_status: "rejected",
      rejection_reason: reason.trim(),
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("approval_status", ["submitted", "branch_approved", "accounts_approved"])
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) {
    return {
      error:
        "Cannot reject: expense is not in an actionable state (must be submitted, branch_approved, or accounts_approved).",
    };
  }

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

  // Approval is single-stage now: any of the legacy *_approved statuses
  // counts as "approved and payable". Cashiers may also bypass entirely.
  const APPROVED_STATES = new Set([
    "branch_approved",
    "accounts_approved",
    "owner_approved",
  ]);
  if (!values.bypass_approval && !APPROVED_STATES.has(expense.approval_status)) {
    return {
      error:
        "Expense is not approved yet. Ask any owner, finance controller, accountant, or this branch's manager to approve it first — or use 'Pay Directly' if you have that permission.",
    };
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

  // Resolve cashbook day — auto-creates for bank accounts, requires open day for cash
  const dayResult = await resolveOrCreateCashbookDay(validated.cashbook_id, validated.payment_date);
  if ("error" in dayResult) return dayResult;
  const day = dayResult.day;

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
