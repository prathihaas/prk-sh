import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getMinHierarchyLevel } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getRolesWithPermissions, getAllPermissions } from "@/lib/queries/roles";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RolePermissionsEditor } from "@/components/shared/role-permissions-editor";
import { ShieldCheck, ShieldAlert } from "lucide-react";

function formatRoleName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export default async function RolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, assignments] = await Promise.all([
    getUserPermissions(supabase, user.id),
    getUserAssignments(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) redirect("/dashboard");

  const minHierarchyLevel = getMinHierarchyLevel(assignments);
  // Only Owner (level 1) and Admin (level 2) can edit role permissions
  const canEdit = minHierarchyLevel <= 2;

  const [roles, allPermissions] = await Promise.all([
    getRolesWithPermissions(),
    getAllPermissions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Roles & Permissions"
        description={
          canEdit
            ? "Manage which permissions are assigned to each role."
            : "View roles and their permissions (read-only for your access level)."
        }
      />

      {/* Access level indicator */}
      {canEdit ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 px-4 py-3 text-sm text-green-800 dark:text-green-200">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            You have <strong>Owner / Admin</strong> access — you can edit role permissions below.
            Click <strong>Edit</strong> on any role card to modify its permissions.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            You can view role permissions but only <strong>Owner and Admin</strong> users can make changes.
          </span>
        </div>
      )}

      {/* Roles Overview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles Hierarchy</CardTitle>
          <CardDescription>
            Roles are ordered by hierarchy level. Lower numbers have broader access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role: any) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    {formatRoleName(role.name)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{role.hierarchy_level}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description}
                  </TableCell>
                  <TableCell className="text-right">
                    {role.role_permissions?.length || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editable / Viewable Role Permissions per Role */}
      <RolePermissionsEditor
        roles={roles as any}
        allPermissions={allPermissions as any}
        canEdit={canEdit}
      />
    </div>
  );
}
