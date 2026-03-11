import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getRolesWithPermissions } from "@/lib/queries/roles";
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

// Group permissions by module for display
function groupByModule(
  permissions: { id: string; module: string; action: string; description: string }[]
) {
  const grouped: Record<string, typeof permissions> = {};
  for (const perm of permissions) {
    if (!grouped[perm.module]) grouped[perm.module] = [];
    grouped[perm.module].push(perm);
  }
  return grouped;
}

function formatRoleName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function formatModuleName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function formatActionName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export default async function RolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) redirect("/dashboard");

  const roles = await getRolesWithPermissions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="System roles and their assigned permissions (read-only)"
      />

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

      {/* Detailed Permissions per Role */}
      <div className="grid gap-6">
        {roles.map((role: any) => {
          const perms = (role.role_permissions || [])
            .map((rp: { permission: { id: string; module: string; action: string; description: string } | null }) => rp.permission)
            .filter(Boolean) as { id: string; module: string; action: string; description: string }[];
          const grouped = groupByModule(perms);
          const modules = Object.keys(grouped).sort();

          return (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">
                    {formatRoleName(role.name)}
                  </CardTitle>
                  <Badge variant="secondary">Level {role.hierarchy_level}</Badge>
                  <Badge variant="outline">{perms.length} permissions</Badge>
                </div>
                <CardDescription>{role.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {modules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No permissions assigned to this role.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {modules.map((mod) => (
                      <div key={mod} className="space-y-2">
                        <h4 className="text-sm font-semibold text-primary">
                          {formatModuleName(mod)}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {grouped[mod].map((perm) => (
                            <Badge
                              key={perm.id}
                              variant="secondary"
                              className="text-xs"
                              title={perm.description}
                            >
                              {formatActionName(perm.action)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
