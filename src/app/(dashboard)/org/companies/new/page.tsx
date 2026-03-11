import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAssignments, getUserPermissions, getUserGroupId } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CompanyForm } from "@/components/forms/company-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function NewCompanyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [assignments, permissions] = await Promise.all([
    getUserAssignments(supabase, user.id),
    getUserPermissions(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) {
    redirect("/dashboard");
  }

  const groupId = getUserGroupId(assignments);
  if (!groupId) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Create Company" description="Add a new company to your group" />
      <CompanyForm groupId={groupId} />
    </div>
  );
}
