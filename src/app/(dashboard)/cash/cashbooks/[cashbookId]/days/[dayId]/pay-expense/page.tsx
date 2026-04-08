import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbook } from "@/lib/queries/cashbooks";
import { getCashbookDay } from "@/lib/queries/cashbook-days";
import { getExpenses } from "@/lib/queries/expenses";
import { getCurrentFinancialYear } from "@/lib/queries/financial-years";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PayExpenseForm } from "./pay-expense-form";

export default async function PayExpensePage({
  params,
}: {
  params: Promise<{ cashbookId: string; dayId: string }>;
}) {
  const { cashbookId, dayId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_CREATE_TXN)) redirect("/dashboard");

  let cashbook, day;
  try {
    [cashbook, day] = await Promise.all([getCashbook(cashbookId), getCashbookDay(dayId)]);
  } catch {
    notFound();
  }

  const backUrl = `/cash/cashbooks/${cashbookId}/days/${dayId}`;

  // Day must be open
  if (day.status !== "open" && day.status !== "reopened") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Day
          </Link>
        </Button>
        <PageHeader
          title="Pay Expense"
          description="This cashbook day is closed and cannot receive new transactions."
        />
      </div>
    );
  }

  const cookieStore = await cookies();
  const companyId = cashbook.company_id;
  const branchId = cookieStore.get("scope_branch_id")?.value ?? cashbook.branch_id ?? "";

  // Get active financial year
  const fy = await getCurrentFinancialYear(companyId);

  // Fetch owner_approved unpaid expenses for this branch
  const allApproved = await getExpenses(companyId, branchId || null, {
    status: "owner_approved",
  });

  // Filter to only unpaid (no payment_date yet)
  const pendingExpenses = allApproved.filter(
    (e: { payment_date?: string | null }) => !e.payment_date
  );

  const dateFormatted = new Date(day.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={backUrl}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {cashbook.name} — {dateFormatted}
        </Link>
      </Button>

      <PageHeader
        title="Pay Expense"
        description={`Record payment from ${cashbook.name} on ${dateFormatted}`}
      />

      <PayExpenseForm
        expenses={pendingExpenses}
        cashbookId={cashbookId}
        dayDate={day.date}
        companyId={companyId}
        branchId={branchId}
        financialYearId={fy?.id ?? null}
        currentUserId={user.id}
        backUrl={backUrl}
      />
    </div>
  );
}
