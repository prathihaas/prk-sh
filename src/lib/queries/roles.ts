"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
 * Uses supabaseAdmin (service role) because role_permissions is a system table
 * with no INSERT/DELETE RLS policies for regular users.
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
) {
  // Delete existing permissions for this role (uses admin client — bypasses RLS)
  const { error: deleteError } = await supabaseAdmin
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (deleteError) return { error: deleteError.message };

  // Insert new permissions (if any)
  if (permissionIds.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("role_permissions")
      .insert(permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid })));

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/admin/roles");
  return { success: true };
}
