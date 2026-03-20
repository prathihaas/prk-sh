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

  if (!companyId || !branchId) redirect("/sales/sales-receipts");

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
