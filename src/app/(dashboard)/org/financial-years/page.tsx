import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getFinancialYears } from "@/lib/queries/financial-years";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function FinancialYearsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_LOCK_FY)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Financial Years" description="Select a company from the header first" />
      </div>
    );
  }

  const financialYears = await getFinancialYears(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Years"
        description="Manage financial years for the selected company"
        action={{ label: "Add Financial Year", href: "/org/financial-years/new" }}
      />
      <DataTable columns={columns} data={financialYears} emptyMessage="No financial years defined" emptyAction={{ label: "Create a financial year", href: "/org/financial-years/new" }} />
    </div>
  );
}
