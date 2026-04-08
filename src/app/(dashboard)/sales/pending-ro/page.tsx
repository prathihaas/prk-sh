import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getPendingRoJobs } from "@/lib/queries/pending-ro";
import { getCashbooks } from "@/lib/queries/cashbooks";
import { getCurrentFinancialYear } from "@/lib/queries/financial-years";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PendingRoClient } from "./pending-ro-client";

export default async function PendingRoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.SALES_RECEIPT_VIEW)) redirect("/dashboard");

  const canCreate = permissions.has(PERMISSIONS.SALES_RECEIPT_CREATE);
  const canIssueGatePass = permissions.has(PERMISSIONS.INVOICE_ALLOW_DELIVERY);

  const cs = await cookies();
  const branchId = cs.get("scope_branch_id")?.value || null;
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cs.get("scope_company_id")?.value
  ) ?? "";
  const fyId = cs.get("scope_financial_year_id")?.value || "";

  const [jobs, rawCashbooks, fyResult] = await Promise.all([
    companyId ? getPendingRoJobs(companyId, branchId) : Promise.resolve([]),
    companyId && branchId
      ? getCashbooks(companyId, branchId, "cash")
      : Promise.resolve([]),
    fyId
      ? Promise.resolve({ data: { id: fyId } })
      : companyId
        ? getCurrentFinancialYear(companyId).then((fy) => ({ data: fy }))
        : Promise.resolve({ data: null }),
  ]);

  const financialYearId = fyResult.data?.id || "";

  const cashbooks = (rawCashbooks as Record<string, unknown>[])
    .filter((cb) => cb.is_active)
    .map((cb) => ({ id: String(cb.id), name: String(cb.name) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending R/O"
        description="Repair orders closed by workshop — awaiting customer payment and vehicle delivery."
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {jobs.filter((j) => !j.completed_at).length} pending
          {jobs.filter((j) => !!j.completed_at).length > 0 &&
            ` · ${jobs.filter((j) => !!j.completed_at).length} completed today`}
        </p>
        {canCreate && (
          <Button asChild>
            <Link href="/sales/pending-ro/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Pending R/O
            </Link>
          </Button>
        )}
      </div>

      <PendingRoClient
        jobs={jobs}
        cashbooks={cashbooks}
        companyId={companyId}
        branchId={branchId || ""}
        financialYearId={financialYearId}
        userId={user.id}
        canCreate={canCreate}
        canIssueGatePass={canIssueGatePass}
      />
    </div>
  );
}
