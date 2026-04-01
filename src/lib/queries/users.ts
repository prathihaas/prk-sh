"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createUserSchema,
  editUserSchema,
  type CreateUserFormValues,
  type EditUserFormValues,
} from "@/lib/validators/user";

export async function getUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("full_name");

  if (error) throw error;
  return data || [];
}

export async function getUserWithAssignments(userId: string) {
  const supabase = await createClient();

  const [profileRes, assignmentsRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", userId).single(),
    supabase
      .from("user_assignments")
      .select(
        `*, role:roles(id, name, hierarchy_level)`
      )
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (profileRes.error) throw profileRes.error;

  return {
    profile: profileRes.data,
    assignments: assignmentsRes.data || [],
  };
}

export async function createUser(
  values: CreateUserFormValues & { group_id: string; assigned_by: string }
) {
  const validated = createUserSchema.parse(values);

  // 1. Create auth user via admin API (bypasses RLS)
  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      password: validated.temporary_password,
      email_confirm: true, // Skip email verification for internal tool
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      return { error: "A user with this email already exists." };
    }
    return { error: authError.message };
  }

  const userId = authUser.user.id;

  // 2. Create user profile (via admin client — bypasses RLS, no INSERT policy on user_profiles)
  const { error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .insert({
      id: userId,
      email: validated.email,
      full_name: validated.full_name,
      phone: validated.phone || null,
    });

  if (profileError) {
    // Cleanup: delete the auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { error: profileError.message };
  }

  // 3. Create user assignment (via admin client — bypasses RLS)
  const { error: assignError } = await supabaseAdmin
    .from("user_assignments")
    .insert({
      user_id: userId,
      role_id: validated.role_id,
      group_id: values.group_id,
      company_id: validated.company_id || null,
      branch_id: validated.branch_id || null,
      assigned_by: values.assigned_by,
    });

  if (assignError) {
    return { error: assignError.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUser(userId: string, values: EditUserFormValues) {
  const validated = editUserSchema.parse(values);
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: validated.full_name,
      phone: validated.phone || null,
      is_active: validated.is_active,
    })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}

export async function addUserAssignment(
  userId: string,
  groupId: string,
  roleId: string,
  companyId: string | null,
  branchId: string | null,
  assignedBy: string
) {
  const supabase = await createClient();

  const { error } = await supabase.from("user_assignments").insert({
    user_id: userId,
    role_id: roleId,
    group_id: groupId,
    company_id: companyId,
    branch_id: branchId,
    assigned_by: assignedBy,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This role+scope assignment already exists for this user." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function revokeUserAssignment(assignmentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_assignments")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}
