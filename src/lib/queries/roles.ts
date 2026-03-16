"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getRoles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("hierarchy_level");

  if (error) throw error;
  return data || [];
}

export async function getRolesWithPermissions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      `
      *,
      role_permissions (
        permission:permissions (
          id,
          module,
          action,
          description
        )
      )
    `
    )
    .order("hierarchy_level");

  if (error) throw error;
  return data || [];
}

export async function getAllPermissions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("id, module, action, description")
    .order("module")
    .order("action");

  if (error) throw error;
  return data || [];
}

/**
 * Replace all permissions for a role with the given set.
 * Only callable by Owner / Admin (hierarchy <= 2) — enforced in the UI.
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
) {
  const supabase = await createClient();

  // Delete existing permissions for this role
  const { error: deleteError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (deleteError) return { error: deleteError.message };

  // Insert new permissions (if any)
  if (permissionIds.length > 0) {
    const { error: insertError } = await supabase
      .from("role_permissions")
      .insert(permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid })));

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/admin/roles");
  return { success: true };
}
