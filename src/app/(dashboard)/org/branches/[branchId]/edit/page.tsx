import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getBranch } from "@/lib/queries/branches";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { BranchForm } from "@/components/forms/branch-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_BRANCHES)) redirect("/dashboard");

  let branch;
  try {
    branch = await getBranch(branchId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Branch" description={`Editing ${branch.name}`} />
      <BranchForm companyId={branch.company_id} branch={branch} />
    </div>
  );
}
