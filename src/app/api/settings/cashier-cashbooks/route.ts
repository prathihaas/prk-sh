/**
 * POST /api/settings/cashier-cashbooks
 * Save cashier-to-cashbook assignments for a company (session auth only).
 * Body: { company_id: string, assignments: Record<string, string | string[]> }
 *
 * The assignments map is: { user_id: cashbook_id[] }. For backward compat the
 * value may also be a single cashbook_id string — it is normalised to a
 * one-element array on save.
 *
 * Cashiers (hierarchy_level >= 5) can only access the cashbooks listed
 * against their user_id. Managers and above are not affected by this map.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";

function uniqueNonEmpty(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === "string" && v.trim().length > 0 && !out.includes(v.trim())) {
      out.push(v.trim());
    }
  }
  return out;
}

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
  const { company_id, assignments } = body;

  if (!company_id) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return Response.json(
      { error: "assignments must be an object mapping user_id → cashbook_id[]" },
      { status: 400 }
    );
  }

  // Normalise each value to string[] (accept single string for back-compat),
  // dedupe, then validate every cashbook id belongs to this company.
  const cleaned: Record<string, string[]> = {};
  for (const [userId, raw] of Object.entries(assignments)) {
    const candidate =
      Array.isArray(raw) ? raw : typeof raw === "string" && raw ? [raw] : [];
    const ids = uniqueNonEmpty(candidate);
    if (ids.length === 0) continue;

    const { data: validCashbooks } = await supabase
      .from("cashbooks")
      .select("id")
      .in("id", ids)
      .eq("company_id", company_id)
      .in("type", ["main", "petty"]);

    const validIds = (validCashbooks || []).map((c: { id: string }) => c.id);
    if (validIds.length > 0) cleaned[userId] = validIds;
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

  const totalLinks = Object.values(cleaned).reduce((n, arr) => n + arr.length, 0);
  return Response.json({
    success: true,
    message: `Saved ${totalLinks} cashbook link(s) across ${Object.keys(cleaned).length} cashier(s)`,
  });
}
