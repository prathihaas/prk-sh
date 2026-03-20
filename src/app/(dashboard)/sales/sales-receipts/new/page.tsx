import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCustomersForSelect } from "@/lib/queries/customers";
import { getCashbooks } from "@/lib/queries/cashbooks";
import {
  getInsuranceCompanies,
  getFinanceCompanies,
} from "@/lib/queries/company-configs";
import { PageHeader } from "@/components/shared/page-header";
import { SalesReceiptForm } from "./sales-receipt-form";

export default async function NewSalesReceiptPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.SALES_RECEIPT_CREATE))
    redirect("/sales/sales-receipts");

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || "";
  const fyId = cs.get("scope_financial_year_id")?.value || "";

  // If scope is not set, show a helpful message instead of silently
  // redirecting. A silent redirect() during soft (Link) navigation shows as
  // HTTP 200 in Vercel logs and the user never sees the form — they just
  // end up back on the list page with no explanation.
  if (!companyId || !branchId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="New Sales Receipt"
          description="Create a one-step invoice and full-payment record for immediate sales."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">Company / Branch not selected</p>
          <p>
            Please select a <strong>Company</strong> and a specific{" "}
            <strong>Branch</strong> from the header before creating a sales
            receipt. You cannot create a receipt without a branch context.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all required data in parallel.
  // .catch() fallback ensures a DB error never crashes the SSR page —
  // the form renders with empty lists and shows errors on submit instead.
  const [
    fyResult,
    customers,
    rawCashbooks,
    insuranceCompanies,
    financeCompanies,
  ] = await Promise.all([
    fyId
      ? Promise.resolve({ data: { id: fyId } })
      : supabase
          .from("financial_years")
          .select("id")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .single(),
    getCustomersForSelect(companyId).catch(() => [] as Awaited<ReturnType<typeof getCustomersForSelect>>),
    getCashbooks(companyId, branchId, "cash").catch(() => []),
    getInsuranceCompanies(companyId).catch(() => [] as string[]),
    getFinanceCompanies(companyId).catch(() => [] as string[]),
  ]);

  const financialYearId = fyResult.data?.id || "";

  // Active cash/petty cashbooks for the cashbook selector
  const cashbooks = (rawCashbooks as Record<string, unknown>[])
    .filter((cb) => cb.is_active)
    .map((cb) => ({ id: String(cb.id), name: String(cb.name) }));

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="New Sales Receipt"
        description="Create a one-step invoice and full-payment record for immediate sales."
      />
      <SalesReceiptForm
        userId={user.id}
        companyId={companyId}
        branchId={branchId}
        financialYearId={financialYearId}
        customers={customers}
        cashbooks={cashbooks}
        insuranceCompanies={insuranceCompanies}
        financeCompanies={financeCompanies}
      />
    </div>
  );
}
