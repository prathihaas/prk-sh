import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getApprovalMatrixEntry } from "@/lib/queries/approval-matrix";
import { getRoles } from "@/lib/queries/roles";
import { ApprovalMatrixForm } from "@/components/forms/approval-matrix-form";

export default async function EditApprovalMatrixEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_CONFIGURE_APPROVAL))
    redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  if (!companyId) redirect("/settings/approval-matrix");

  let entry;
  try {
    entry = await getApprovalMatrixEntry(entryId);
  } catch {
    notFound();
  }

  const allRoles = await getRoles();
  const roles = allRoles.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  return (
    <div className="space-y-6">
      <ApprovalMatrixForm companyId={companyId} roles={roles} entry={entry} />
    </div>
  );
}
