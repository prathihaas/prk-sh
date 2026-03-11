import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getBranches } from "@/lib/queries/branches";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function BranchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_BRANCHES)) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Branches" description="Select a company from the header to view branches" />
      </div>
    );
  }

  const branches = await getBranches(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage branches for the selected company"
        action={{ label: "Add Branch", href: "/org/branches/new" }}
      />
      <DataTable
        columns={columns}
        data={branches}
        emptyMessage="No branches yet"
        emptyAction={{ label: "Create your first branch", href: "/org/branches/new" }}
      />
    </div>
  );
}
