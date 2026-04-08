import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getMinHierarchyLevel,
} from "@/lib/auth/helpers";
import { getExpense } from "@/lib/queries/expenses";
import { getActiveCashbooksForUser } from "@/lib/queries/cashbooks";
import { getCurrentFinancialYear } from "@/lib/queries/financial-years";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ExpensePaymentForm } from "@/components/forms/expense-payment-form";

export default async function PayExpensePage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, assignments] = await Promise.all([
    getUserPermissions(supabase, user.id),
    getUserAssignments(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.CASHBOOK_CREATE_TXN)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pay Expense"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  let expense;
  try {
    expense = await getExpense(expenseId);
  } catch {
    notFound();
  }

  if (!expense) notFound();

  if (expense.payment_date) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pay Expense"
          description="This expense has already been paid."
        />
      </div>
    );
  }

  // Cashiers can pay directly (bypass_approval) even if not fully approved
  // Accounts/owners must wait for full approval unless they have pay_direct permission
  const canBypassApproval = permissions.has(PERMISSIONS.EXPENSE_PAY_DIRECT);
  const isFullyApproved = expense.approval_status === "owner_approved";

  if (!isFullyApproved && !canBypassApproval) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pay Expense"
          description="This expense must be fully approved (owner_approved) before payment. Contact your manager or use cashier direct payment if you have that access."
        />
      </div>
    );
  }

  // Get active financial year
  const fy = await getCurrentFinancialYear(companyId);

  const hierarchyLevel = getMinHierarchyLevel(assignments);

  // Cashiers can only pay via their assigned cashbook
  const cashbooks = await getActiveCashbooksForUser(
    companyId,
    branchId,
    user.id,
    hierarchyLevel
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pay Expense"
        description="Record payment through a cashbook. The payment date must fall on an open cashbook day."
      />
      <ExpensePaymentForm
        expenseId={expenseId}
        companyId={companyId}
        branchId={branchId || ""}
        currentUserId={user.id}
        financialYearId={fy?.id || ""}
        expense={{
          description: expense.description,
          amount: expense.amount,
          category_name: expense.category?.name || "Expense",
          expense_date: expense.expense_date,
          approval_status: expense.approval_status,
        }}
        cashbooks={cashbooks}
        canBypassApproval={canBypassApproval && !isFullyApproved}
      />
    </div>
  );
}
