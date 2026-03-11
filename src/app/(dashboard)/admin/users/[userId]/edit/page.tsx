import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUserAssignments,
  getUserPermissions,
  getUserGroupId,
  getAccessibleCompanies,
} from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getUserWithAssignments } from "@/lib/queries/users";
import { getRoles } from "@/lib/queries/roles";
import { EditUserForm } from "@/components/forms/edit-user-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [assignments, permissions] = await Promise.all([
    getUserAssignments(supabase, user.id),
    getUserPermissions(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) redirect("/dashboard");

  const groupId = getUserGroupId(assignments);
  if (!groupId) redirect("/dashboard");

  let userData;
  try {
    userData = await getUserWithAssignments(userId);
  } catch {
    notFound();
  }

  const [roles, companies] = await Promise.all([
    getRoles(),
    getAccessibleCompanies(supabase, assignments),
  ]);

  // Get all branches for all companies
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, company_id")
    .in("company_id", companies.map((c) => c.id))
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit User"
        description={`Managing ${userData.profile.full_name}`}
      />
      <EditUserForm
        userId={userId}
        profile={userData.profile}
        assignments={userData.assignments}
        groupId={groupId}
        currentUserId={user.id}
        roles={roles}
        companies={companies}
        branches={branches || []}
      />
    </div>
  );
}
