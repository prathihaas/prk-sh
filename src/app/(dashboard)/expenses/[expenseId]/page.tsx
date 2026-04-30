import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getExpenseWithContext } from "@/lib/queries/expenses";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { PrintExpenseVoucher } from "@/components/shared/print-expense-voucher";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpenseApprovalProgress } from "@/components/shared/expense-approval-progress";
import { formatINR } from "@/components/shared/currency-display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Pencil, CheckCircle } from "lucide-react";

export default async function ExpenseDetailPage({
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

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.EXPENSE_SUBMIT)) redirect("/dashboard");

  let data;
  try {
    data = await getExpenseWithContext(expenseId);
  } catch {
    notFound();
  }

  const { expense, company, branch } = data;

  const canPay =
    !expense.payment_date &&
    expense.approval_status !== "rejected" &&
    permissions.has(PERMISSIONS.CASHBOOK_CREATE_TXN);

  const canEdit =
    (expense.approval_status === "draft" ||
      expense.approval_status === "submitted") &&
    !expense.payment_date;

  const canApprove =
    (permissions.has(PERMISSIONS.EXPENSE_APPROVE_BRANCH) &&
      expense.approval_status === "submitted") ||
    (permissions.has(PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS) &&
      expense.approval_status === "branch_approved") ||
    (permissions.has(PERMISSIONS.EXPENSE_APPROVE_OWNER) &&
      expense.approval_status === "accounts_approved");

  // Build voucher number: EXP-YYYY-XXXX
  const year = new Date(expense.expense_date).getFullYear();
  const shortId = expense.id.replace(/-/g, "").substring(0, 6).toUpperCase();
  const voucherNumber = `EXP-${year}-${shortId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/expenses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Expenses
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Expense — ${voucherNumber}`}
        description="View expense details and print Indian IT-format payment voucher"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Approval Progress</CardTitle>
          <CardDescription>
            {expense.approval_status === "draft" && "Draft — submit it to start the approval flow."}
            {expense.approval_status === "submitted" && "Waiting for branch manager approval."}
            {expense.approval_status === "branch_approved" && "Approved by branch — waiting for accounts."}
            {expense.approval_status === "accounts_approved" && "Approved by accounts — waiting for owner."}
            {expense.approval_status === "owner_approved" && "Fully approved — ready to be paid."}
            {expense.approval_status === "paid" && "Payment recorded."}
            {expense.approval_status === "paid_direct" && "Paid directly by cashier (bypassed approval)."}
            {expense.approval_status === "rejected" && (
              <span className="text-red-600">
                Rejected{expense.rejection_reason ? `: ${expense.rejection_reason}` : ""}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseApprovalProgress status={expense.approval_status} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main: Printable Voucher */}
        <div className="lg:col-span-3">
          <PrintExpenseVoucher
            expense={expense}
            voucher_number={voucherNumber}
            company={company}
            branch={branch}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status</CardTitle>
              <CardDescription>Current approval stage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Approval</span>
                <StatusBadge status={expense.approval_status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold tabular-nums">
                  {formatINR(expense.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expense Date</span>
                <span>
                  {new Date(expense.expense_date).toLocaleDateString("en-IN")}
                </span>
              </div>
              {expense.payment_date && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Paid On</span>
                  <span className="text-green-600 font-medium">
                    {new Date(expense.payment_date).toLocaleDateString("en-IN")}
                  </span>
                </div>
              )}
              {expense.payment_mode && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="capitalize">
                    {expense.payment_mode.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              {expense.cashbook?.name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cashbook</span>
                  <span>{expense.cashbook.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canEdit && (
                <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                  <Link href={`/expenses/${expenseId}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Edit Expense
                  </Link>
                </Button>
              )}
              {canApprove && (
                <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                  <Link href={`/expenses/${expenseId}/approve`}>
                    <CheckCircle className="h-4 w-4" />
                    Approve / Reject
                  </Link>
                </Button>
              )}
              {canPay && (
                <Button size="sm" className="w-full gap-2" asChild>
                  <Link href={`/expenses/${expenseId}/pay`}>
                    <CreditCard className="h-4 w-4" />
                    Pay via Cashbook
                  </Link>
                </Button>
              )}
              {!canEdit && !canApprove && !canPay && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No actions available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bill Reference */}
          {(expense.bill_reference || expense.notes) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">References</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {expense.bill_reference && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Bill Reference</p>
                    <p className="font-mono">{expense.bill_reference}</p>
                  </div>
                )}
                {expense.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                    <p>{expense.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
