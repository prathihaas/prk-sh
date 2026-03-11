import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCompaniesAndBranches } from "@/lib/queries/transfers";
import { PageHeader } from "@/components/shared/page-header";
import { BranchTransferForm } from "@/components/forms/branch-transfer-form";

export default async function NewTransferPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.TRANSFER_CREATE)) redirect("/transfers");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId || !branchId) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Transfer" description="Select a company and branch from the header first" />
      </div>
    );
  }

  // Get group_id for this company
  const { data: company } = await supabase
    .from("companies")
    .select("group_id")
    .eq("id", companyId)
    .single();

  if (!company?.group_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Transfer" description="Company group not found" />
      </div>
    );
  }

  const companies = await getCompaniesAndBranches(company.group_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Transfer"
        description="Create an inter-branch or inter-company transfer. A Transfer Challan will be generated automatically."
      />
      <BranchTransferForm
        fromCompanyId={companyId}
        fromBranchId={branchId}
        groupId={company.group_id}
        currentUserId={user.id}
        companies={companies as any}
      />
    </div>
  );
}
