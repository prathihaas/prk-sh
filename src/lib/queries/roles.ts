"use server";

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
