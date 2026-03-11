/**
 * POST /api/settings/user-assignments
 * Save a user's company + branch access assignments.
 * Body: {
 *   user_id: string,
 *   role_id: string,          // role to assign (e.g. branch_manager)
 *   company_assignments: {
 *     company_id: string,
 *     branch_ids: string[],   // empty = all branches (wildcard)
 *   }[]
 * }
 *
 * Strategy:
 * 1. Deactivate all existing assignments for the user in the same group
 * 2. Insert new assignments per company+branch combination
 * - If branch_ids is empty for a company → insert one assignment with branch_id = null (all branches)
 * - Otherwise → insert one row per branch
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getUserGroupId } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { user_id, role_id, company_assignments } = body as {
    user_id: string;
    role_id: string;
    company_assignments: { company_id: string; branch_ids: string[] }[];
  };

  if (!user_id || !role_id || !Array.isArray(company_assignments)) {
    return Response.json({ error: "user_id, role_id, and company_assignments are required" }, { status: 400 });
  }

  // Get the admin's group so we only touch users in the same group
  const adminAssignments = await getUserAssignments(supabase, user.id);
  const groupId = getUserGroupId(adminAssignments);

  if (!groupId) {
    return Response.json({ error: "Could not determine group" }, { status: 400 });
  }

  // Verify the role exists
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", role_id)
    .single();

  if (roleError || !role) {
    return Response.json({ error: "Invalid role_id" }, { status: 400 });
  }

  // Deactivate all current assignments for this user in this group
  const { error: deactivateError } = await supabase
    .from("user_assignments")
    .update({ is_active: false })
    .eq("user_id", user_id)
    .eq("group_id", groupId);

  if (deactivateError) {
    return Response.json({ error: deactivateError.message }, { status: 500 });
  }

  if (company_assignments.length === 0) {
    // No access at all — just deactivated everything
    return Response.json({ success: true, message: "User access revoked" });
  }

  // Build new assignment rows
  const rows: {
    user_id: string;
    role_id: string;
    group_id: string;
    company_id: string | null;
    branch_id: string | null;
    is_active: boolean;
    assigned_at: string;
  }[] = [];

  for (const ca of company_assignments) {
    if (!ca.company_id) continue;

    if (!ca.branch_ids || ca.branch_ids.length === 0) {
      // All branches for this company (wildcard)
      rows.push({
        user_id,
        role_id,
        group_id: groupId,
        company_id: ca.company_id,
        branch_id: null,
        is_active: true,
        assigned_at: new Date().toISOString(),
      });
    } else {
      // Specific branches
      for (const branchId of ca.branch_ids) {
        rows.push({
          user_id,
          role_id,
          group_id: groupId,
          company_id: ca.company_id,
          branch_id: branchId,
          is_active: true,
          assigned_at: new Date().toISOString(),
        });
      }
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("user_assignments").insert(rows);
    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }
  }

  return Response.json({
    success: true,
    message: `Saved ${rows.length} assignment(s) for user`,
  });
}
