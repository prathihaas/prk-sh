import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbook, getCashbooks } from "@/lib/queries/cashbooks";
import { getCashbookDay } from "@/lib/queries/cashbook-days";
import { getCustomersForSelect } from "@/lib/queries/customers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CashbookTransactionForm } from "@/components/forms/cashbook-transaction-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function NewTransactionPage({
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
    [cashbook, day] = await Promise.all([
      getCashbook(cashbookId),
      getCashbookDay(dayId),
    ]);
  } catch {
    notFound();
  }

  // Verify day is open
  if (day.status !== "open" && day.status !== "reopened") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cannot Add Transaction"
          description="This day is closed. Reopen it first to add transactions."
        />
      </div>
    );
  }

  // Get other cashbooks, customers, and financial year in parallel
  const cookieStore = await cookies();
  const [allCashbooks, customers, { data: fy }] = await Promise.all([
    getCashbooks(cashbook.company_id, cashbook.branch_id),
    getCustomersForSelect(cashbook.company_id),
    supabase
      .from("financial_years")
      .select("id")
      .eq("company_id", cashbook.company_id)
      .eq("is_locked", false)
      .order("start_date", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const otherCashbooks = allCashbooks
    .filter((cb: any) => cb.id !== cashbookId && cb.is_active)
    .map((cb: any) => ({ id: cb.id, name: cb.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Transaction"
        description={`Recording in ${cashbook.name}`}
      />
      <CashbookTransactionForm
        cashbookId={cashbookId}
        cashbookDayId={dayId}
        companyId={cashbook.company_id}
        branchId={cashbook.branch_id}
        financialYearId={fy?.id}
        currentUserId={user.id}
        customers={customers}
        otherCashbooks={otherCashbooks}
      />
    </div>
  );
}
