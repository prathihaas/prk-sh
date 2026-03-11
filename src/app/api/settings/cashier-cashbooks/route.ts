/**
 * POST /api/settings/cashier-cashbooks
 * Save cashier-to-cashbook assignments for a company (session auth only).
 * Body: { company_id: string, assignments: Record<string, string> }
 *
 * The assignments map is: { user_id: cashbook_id }
 * Cashiers (hierarchy_level >= 5) can only access their one assigned cashbook.
 * Managers and above are not affected by this map.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins who can manage users may set cashier assignments
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { company_id, assignments } = body;

  if (!company_id) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return Response.json({ error: "assignments must be an object mapping user_id → cashbook_id" }, { status: 400 });
  }

  // Validate: all values must be non-empty strings (cashbook IDs) or we skip them
  const cleaned: Record<string, string> = {};
  for (const [userId, cashbookId] of Object.entries(assignments)) {
    if (typeof cashbookId === "string" && cashbookId.trim().length > 0) {
      // Verify the cashbook belongs to this company before saving
      const { data: cb } = await supabase
        .from("cashbooks")
        .select("id")
        .eq("id", cashbookId.trim())
        .eq("company_id", company_id)
        .in("type", ["main", "petty"])
        .single();

      if (cb) {
        cleaned[userId] = cashbookId.trim();
      }
      // If cashbook not found / wrong company, silently drop this assignment
    }
    // If cashbookId is empty/null, skip → effectively removes the assignment
  }

  const { error } = await supabase
    .from("company_configs")
    .upsert(
      {
        company_id,
        config_key: "cashier_cashbook_assignments",
        config_value: cleaned,
      },
      { onConflict: "company_id,config_key" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: `Saved cashbook assignments for ${Object.keys(cleaned).length} cashier(s)`,
  });
}
