import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCompanies } from "@/lib/queries/companies";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) {
    redirect("/dashboard");
  }

  const companies = await getCompanies();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Manage companies in your dealership group"
        action={{ label: "Add Company", href: "/org/companies/new" }}
      />
      <DataTable
        columns={columns}
        data={companies}
        emptyMessage="No companies yet"
        emptyAction={{ label: "Create your first company", href: "/org/companies/new" }}
      />
    </div>
  );
}
