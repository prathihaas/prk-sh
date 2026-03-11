/**
 * POST /api/settings/user-permissions
 * Save per-user permission overrides for a company (session auth only).
 * Body: { company_id: string, overrides: Record<string, string[]> }
 *
 * The overrides map is: { user_id: ["permission:key", ...] }
 * These are merged with role-based permissions at runtime in getUserPermissions().
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_OVERRIDEABLE_PERMISSIONS = new Set([
  "receipt:backdate",
  "receipt:delete",
  "expense:pay_direct",
  "cashbook:reopen_day",
  "cashbook:void_transaction",
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { company_id, overrides } = body;

  if (!company_id) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }
  if (!overrides || typeof overrides !== "object") {
    return Response.json({ error: "overrides must be an object" }, { status: 400 });
  }

  // Validate that only allowed permissions are being granted
  for (const [userId, perms] of Object.entries(overrides)) {
    if (!Array.isArray(perms)) {
      return Response.json(
        { error: `Permissions for user ${userId} must be an array` },
        { status: 400 }
      );
    }
    for (const perm of perms) {
      if (!ALLOWED_OVERRIDEABLE_PERMISSIONS.has(perm as string)) {
        return Response.json(
          { error: `Permission "${perm}" cannot be granted as a user override` },
          { status: 400 }
        );
      }
    }
  }

  // Remove users with empty permission arrays (clean up)
  const cleanedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, perms]) => (perms as string[]).length > 0)
  );

  const { error } = await supabase
    .from("company_configs")
    .upsert(
      {
        company_id,
        config_key: "user_permission_overrides",
        config_value: cleanedOverrides,
      },
      { onConflict: "company_id,config_key" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: `Saved permission overrides for ${Object.keys(cleanedOverrides).length} user(s)`,
  });
}
