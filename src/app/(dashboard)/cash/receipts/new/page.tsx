import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getMinHierarchyLevel,
} from "@/lib/auth/helpers";
import { getActiveCashbooksForUser } from "@/lib/queries/cashbooks";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ReceiptForm } from "@/components/forms/receipt-form";

export default async function NewReceiptPage() {
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
          title="New Receipt"
          description="Select a company from the header first"
        />
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

  // Cashiers see only their assigned cashbook; managers see all
  const cashbooks = await getActiveCashbooksForUser(
    companyId,
    branchId,
    user.id,
    hierarchyLevel
  );

  const canBackdate = permissions.has(PERMISSIONS.RECEIPT_BACKDATE);

  if (cashbooks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New Receipt"
          description="No cashbook available"
        />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>No cashbook assigned.</strong> You have not been assigned a cashbook.
          Please contact your branch manager to assign a cashbook to your account before creating receipts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Receipt"
        description="Create a new receipt. It will be recorded in the selected cashbook's open day."
      />
      {!canBackdate && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          <strong>Note:</strong> Backdated receipts are not allowed. The receipt date cannot be earlier than today. Only authorized users can enter backdated receipts.
        </div>
      )}
      <ReceiptForm
        companyId={companyId}
        branchId={branchId || ""}
        currentUserId={user.id}
        financialYearId={fy?.id || ""}
        cashbooks={cashbooks}
        canBackdate={canBackdate}
      />
    </div>
  );
}
