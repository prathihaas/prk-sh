import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getPayrollRuns } from "@/lib/queries/payroll";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function PayrollPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PAYROLL_PROCESS)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payroll"
          description="Select a company from the header"
        />
      </div>
    );

  const runs = await getPayrollRuns(companyId, branchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Monthly payroll processing"
        action={{ label: "New Run", href: "/hr/payroll/new" }}
      />
      <DataTable
        columns={columns}
        data={runs}
        emptyMessage="No payroll runs found"
      />
    </div>
  );
}
