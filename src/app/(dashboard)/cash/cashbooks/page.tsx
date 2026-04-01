import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getMinHierarchyLevel,
  resolveCompanyScope,
} from "@/lib/auth/helpers";
import { getCashbooksForUser } from "@/lib/queries/cashbooks";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function CashbooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, assignments] = await Promise.all([
    getUserPermissions(supabase, user.id),
    getUserAssignments(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  const branchId = cookieStore.get("scope_branch_id")?.value;
  // resolveCompanyScope falls back to first accessible company when no cookie is set
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value,
    assignments
  );

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cashbooks"
          description="Select a company from the header to view cashbooks"
        />
      </div>
    );
  }

  const hierarchyLevel = getMinHierarchyLevel(assignments);

  // Cashiers see only their assigned cashbook; managers+ see all
  const cashbooks = await getCashbooksForUser(
    companyId,
    branchId,
    user.id,
    hierarchyLevel,
    "cash"
  );

  const isCashierLevel = hierarchyLevel >= 5;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cashbooks"
        description={
          isCashierLevel
            ? "Your assigned cashbook"
            : "Manage main cash and petty cash books (bank accounts are in Bank Accounts section)"
        }
        action={
          permissions.has(PERMISSIONS.CASHBOOK_CREATE) && !isCashierLevel
            ? { label: "Add Cashbook", href: "/cash/cashbooks/new" }
            : undefined
        }
      />
      {isCashierLevel && cashbooks.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>No cashbook assigned.</strong> You have not been assigned a cashbook yet.
          Please contact your branch manager or administrator to assign a cashbook to your account.
        </div>
      )}
      <DataTable
        columns={columns}
        data={cashbooks}
        emptyMessage={
          isCashierLevel
            ? "No cashbook assigned to you. Contact your manager."
            : "No cashbooks found"
        }
        emptyAction={
          permissions.has(PERMISSIONS.CASHBOOK_CREATE) && !isCashierLevel
            ? {
                label: "Create your first cashbook",
                href: "/cash/cashbooks/new",
              }
            : undefined
        }
      />
    </div>
  );
}
