import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getExpenseWithContext } from "@/lib/queries/expenses";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseApprovalProgress } from "@/components/shared/expense-approval-progress";
import { ExpenseApprovalActions } from "./expense-approval-actions";
import { formatINR } from "@/components/shared/currency-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Stage = "branch" | "accounts" | "owner" | null;

function nextStage(status: string): Stage {
  if (status === "submitted") return "branch";
  if (status === "branch_approved") return "accounts";
  if (status === "accounts_approved") return "owner";
  return null;
}

const STAGE_LABEL: Record<NonNullable<Stage>, string> = {
  branch: "Branch Manager Approval",
  accounts: "Accounts Approval",
  owner: "Owner / Final Approval",
};

/**
 * Higher-tier approvers can act on lower-tier stages too.
 * - APPROVE_OWNER  → can approve owner / accounts / branch
 * - APPROVE_ACCOUNTS → can approve accounts / branch
 * - APPROVE_BRANCH → can only approve branch
 *
 * This lets Owners/Admins (who hold APPROVE_OWNER) sign off at any stage —
 * useful when a branch manager is unavailable, etc. The server action itself
 * still enforces the state machine (only the right starting status moves to
 * the right ending status), so an owner can't skip stages — they advance one
 * step at a time.
 */
const STAGE_PERMS: Record<NonNullable<Stage>, string[]> = {
  branch: [
    PERMISSIONS.EXPENSE_APPROVE_BRANCH,
    PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS,
    PERMISSIONS.EXPENSE_APPROVE_OWNER,
  ],
  accounts: [
    PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS,
    PERMISSIONS.EXPENSE_APPROVE_OWNER,
  ],
  owner: [PERMISSIONS.EXPENSE_APPROVE_OWNER],
};

export default async function ApproveExpensePage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);

  let data;
  try {
    data = await getExpenseWithContext(expenseId);
  } catch {
    notFound();
  }

  const { expense } = data;
  const stage = nextStage(expense.approval_status);

  // Terminal states: nothing to approve
  if (!stage) {
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
                : "This expense has already passed all approval stages."
          }
        />
        <ExpenseApprovalProgress status={expense.approval_status} />
      </div>
    );
  }

  const allowedPerms = STAGE_PERMS[stage];
  const canApprove = allowedPerms.some((p) => permissions.has(p));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/expenses/${expenseId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Expense
        </Link>
      </Button>

      <PageHeader
        title={`${STAGE_LABEL[stage]}`}
        description="Review the expense below, then approve or reject. Approval moves it to the next stage; rejection stops the flow."
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
        <ExpenseApprovalActions
          expenseId={expenseId}
          stage={stage}
          stageLabel={STAGE_LABEL[stage]}
        />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            You do not have permission to approve this stage ({STAGE_LABEL[stage]}).
            <br />
            Required (any of): <code className="font-mono">{allowedPerms.join(", ")}</code>
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
