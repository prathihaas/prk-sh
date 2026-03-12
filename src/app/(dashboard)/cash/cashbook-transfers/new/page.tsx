import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getMinHierarchyLevel } from "@/lib/auth/helpers";
import { getCashbooks } from "@/lib/queries/cashbooks";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { CashbookTransferForm } from "@/components/forms/cashbook-transfer-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewCashbookTransferPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, assignments] = await Promise.all([
    getUserPermissions(supabase, user.id),
    getUserAssignments(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.CASHBOOK_TRANSFER_CREATE)) redirect("/cash/cashbook-transfers");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Cashbook Transfer" description="Select a company from the header first" />
      </div>
    );
  }

  // Get active financial year
  const { data: fy } = await supabase
    .from("financial_years")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .single();

  const hierarchyLevel = getMinHierarchyLevel(assignments);

  // All active cashbooks for this company (cash + bank)
  // Managers can transfer between any cashbooks
  const allCashbooks = await getCashbooks(companyId, branchId, null);
  const activeCashbooks = allCashbooks.filter((c: { is_active: boolean }) => c.is_active);

  if (activeCashbooks.length < 2) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cash/cashbook-transfers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transfers
          </Link>
        </Button>
        <PageHeader title="New Cashbook Transfer" description="Not enough cashbooks" />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You need at least 2 active cashbooks to create an internal transfer.
          Please create or activate cashbooks first.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/cash/cashbook-transfers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>
      </Button>
      <PageHeader
        title="New Cashbook Transfer"
        description="Request an internal transfer. An accountant must approve before funds move."
      />
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <strong>Note:</strong> This transfer will be placed in <em>Pending</em> status.
        An accountant with approval rights must approve it before the cashbooks are debited/credited.
      </div>
      <CashbookTransferForm
        companyId={companyId}
        branchId={branchId || null}
        financialYearId={fy?.id || null}
        currentUserId={user.id}
        cashbooks={activeCashbooks.map((c: { id: string; name: string; type: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }))}
      />
    </div>
  );
}
