"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Save, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateRolePermissions } from "@/lib/queries/roles";

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  hierarchy_level: number;
  role_permissions: { permission: Permission | null }[];
}

interface RolePermissionsEditorProps {
  roles: Role[];
  allPermissions: Permission[];
  canEdit: boolean;
}

function formatLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Groups permissions by module, returning sorted module names */
function groupByModule(permissions: Permission[]): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};
  for (const perm of permissions) {
    if (!grouped[perm.module]) grouped[perm.module] = [];
    grouped[perm.module].push(perm);
  }
  return grouped;
}

function RoleCard({
  role,
  allPermissions,
  canEdit,
}: {
  role: Role;
  allPermissions: Permission[];
  canEdit: boolean;
}) {
  const initialPermIds = new Set(
    role.role_permissions.map((rp) => rp.permission?.id).filter(Boolean) as string[]
  );

  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPermIds));
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const grouped = groupByModule(allPermissions);
  const modules = Object.keys(grouped).sort();

  const currentPerms = role.role_permissions
    .map((rp) => rp.permission)
    .filter(Boolean) as Permission[];
  const currentGrouped = groupByModule(currentPerms);
  const currentModules = Object.keys(currentGrouped).sort();

  function togglePerm(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(module: string) {
    const modulePerms = grouped[module].map((p) => p.id);
    const allChecked = modulePerms.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) modulePerms.forEach((id) => next.delete(id));
      else modulePerms.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleCancel() {
    setSelected(new Set(initialPermIds));
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateRolePermissions(role.id, Array.from(selected));
      if (result.error) {
        toast.error(`Failed to save: ${result.error}`);
      } else {
        toast.success(`Permissions updated for ${formatLabel(role.name)}`);
        setEditing(false);
        // Update the local initial set so cancel works correctly after save
        initialPermIds.clear();
        selected.forEach((id) => initialPermIds.add(id));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-lg">{formatLabel(role.name)}</CardTitle>
            <Badge variant="secondary">Level {role.hierarchy_level}</Badge>
            <Badge variant="outline">{selected.size} permissions</Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditing(true); setExpanded(true); }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            {editing && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
        <CardDescription>{role.description}</CardDescription>
      </CardHeader>

      <CardContent>
        {/* View mode — grouped badge display */}
        {!editing && (
          <>
            {currentModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions assigned.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(expanded ? currentModules : currentModules.slice(0, 6)).map((mod) => (
                    <div key={mod} className="space-y-1.5">
                      <h4 className="text-sm font-semibold text-primary">{formatLabel(mod)}</h4>
                      <div className="flex flex-wrap gap-1">
                        {currentGrouped[mod].map((perm) => (
                          <Badge key={perm.id} variant="secondary" className="text-xs" title={perm.description}>
                            {formatLabel(perm.action)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {currentModules.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-muted-foreground"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? (
                      <><ChevronUp className="mr-1 h-4 w-4" />Show less</>
                    ) : (
                      <><ChevronDown className="mr-1 h-4 w-4" />Show {currentModules.length - 6} more modules</>
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {/* Edit mode — checkbox interface grouped by module */}
        {editing && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Check the permissions you want to grant to this role. Click a module header to select/deselect all.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => {
                const modulePerms = grouped[mod];
                const allChecked = modulePerms.every((p) => selected.has(p.id));
                const someChecked = modulePerms.some((p) => selected.has(p.id));
                return (
                  <div key={mod} className="border rounded-lg p-3 space-y-2">
                    {/* Module header — click to toggle all */}
                    <button
                      type="button"
                      onClick={() => toggleModule(mod)}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      <Checkbox
                        checked={allChecked}
                        // indeterminate via data-state
                        data-state={someChecked && !allChecked ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                        className="pointer-events-none"
                        aria-hidden
                      />
                      <span className="text-sm font-semibold text-primary">
                        {formatLabel(mod)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {modulePerms.filter((p) => selected.has(p.id)).length}/{modulePerms.length}
                      </span>
                    </button>
                    {/* Individual permissions */}
                    <div className="space-y-1 pl-1">
                      {modulePerms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 cursor-pointer py-0.5 group"
                        >
                          <Checkbox
                            checked={selected.has(perm.id)}
                            onCheckedChange={() => togglePerm(perm.id)}
                          />
                          <span className="text-sm group-hover:text-foreground text-muted-foreground">
                            {formatLabel(perm.action)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RolePermissionsEditor({
  roles,
  allPermissions,
  canEdit,
}: RolePermissionsEditorProps) {
  return (
    <div className="grid gap-6">
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          allPermissions={allPermissions}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
