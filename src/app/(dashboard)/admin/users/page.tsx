import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getUsers } from "@/lib/queries/users";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) redirect("/dashboard");

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users and their role assignments"
        action={{ label: "Add User", href: "/admin/users/new" }}
      />
      <DataTable columns={columns} data={users} emptyMessage="No users found" emptyAction={{ label: "Create your first user", href: "/admin/users/new" }} />
    </div>
  );
}
