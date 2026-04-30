import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getExpenseWithContext } from "@/lib/queries/expenses";
import { isUserEligibleExpenseApprover } from "@/lib/queries/expense-approvers";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseApprovalProgress } from "@/components/shared/expense-approval-progress";
import { ExpenseApprovalActions } from "./expense-approval-actions";
import { formatINR } from "@/components/shared/currency-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function ApproveExpensePage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let data;
  try {
    data = await getExpenseWithContext(expenseId);
  } catch {
    notFound();
  }

  const { expense } = data;

  if (expense.approval_status !== "submitted") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/expenses/${expenseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Expense
          </Link>
        </Button>
        <PageHeader
          title="No Action Needed"
          description={
            expense.approval_status === "rejected"
              ? "This expense was rejected — no further approval is possible."
              : expense.approval_status === "draft"
                ? "This expense is still a draft. The submitter must submit it before approval."
                : "This expense has already been approved."
          }
        />
        <ExpenseApprovalProgress status={expense.approval_status} />
      </div>
    );
  }

  const canApprove =
    expense.submitted_by !== user.id &&
    (await isUserEligibleExpenseApprover(
      supabase,
      user.id,
      expense.company_id,
      expense.branch_id ?? null
    ));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/expenses/${expenseId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Expense
        </Link>
      </Button>

      <PageHeader
        title="Approve Expense"
        description="Review the expense below, then approve or reject. One approval is enough — the expense becomes payable immediately."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseApprovalProgress status={expense.approval_status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Amount" value={<span className="font-bold tabular-nums">{formatINR(expense.amount)}</span>} />
          <Detail label="Category" value={expense.category?.name || "—"} />
          <Detail label="Date" value={new Date(expense.expense_date).toLocaleDateString("en-IN")} />
          <Detail label="Submitted by" value={expense.submitter?.full_name || "—"} />
          <Detail label="Description" value={expense.description} className="sm:col-span-2" />
          {expense.bill_reference && (
            <Detail label="Bill Reference" value={<span className="font-mono">{expense.bill_reference}</span>} />
          )}
          {expense.notes && (
            <Detail label="Notes" value={expense.notes} className="sm:col-span-2" />
          )}
        </CardContent>
      </Card>

      {canApprove ? (
        <ExpenseApprovalActions expenseId={expenseId} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {expense.submitted_by === user.id
              ? "You can't approve an expense you submitted yourself."
              : "You are not authorised to approve this expense. Only owners, finance controllers, accountants, or this branch's manager can approve."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div>{value}</div>
    </div>
  );
}
