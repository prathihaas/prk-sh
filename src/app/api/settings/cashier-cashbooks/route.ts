/**
 * POST /api/settings/cashier-cashbooks
 *
 * Save cashier-to-cashbook assignments. Each cashbook is stored in the
 * `cashier_cashbook_assignments` config row of the cashbook's OWN company —
 * so a single cashier can be assigned cashbooks from multiple companies and
 * each one ends up in the right config row.
 *
 * Body: { assignments: Record<userId, cashbookId | cashbookId[]> }
 *       (legacy: { company_id, assignments } is still accepted but company_id
 *        is ignored — every cashbook is routed to its own company.)
 *
 * Cashiers (hierarchy_level >= 5) only see the cashbooks listed against
 * their user_id (across all companies they have scope in). Managers and
 * above are unaffected.
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
  const { assignments } = body;

  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return Response.json(
      { error: "assignments must be an object mapping user_id → cashbook_id[]" },
      { status: 400 }
    );
  }

  // Flatten to (userId, cashbookId) pairs and dedupe.
  type Pair = { userId: string; cashbookId: string };
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  for (const [userId, raw] of Object.entries(assignments)) {
    const candidate =
      Array.isArray(raw) ? raw : typeof raw === "string" && raw ? [raw] : [];
    for (const cb of uniqueNonEmpty(candidate)) {
      const key = `${userId}::${cb}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ userId, cashbookId: cb });
      }
    }
  }

  // Look up each cashbook's actual company_id and type so we can route the
  // assignment to the right config row and reject non-cash cashbooks.
  const cashbookIds = Array.from(new Set(pairs.map((p) => p.cashbookId)));
  const cashbookCompany = new Map<string, string>();
  if (cashbookIds.length > 0) {
    const { data: cashbookRows } = await supabase
      .from("cashbooks")
      .select("id, company_id, type")
      .in("id", cashbookIds)
      .in("type", ["main", "petty"]);
    for (const cb of (cashbookRows || []) as Array<{
      id: string; company_id: string; type: string;
    }>) {
      cashbookCompany.set(cb.id, cb.company_id);
    }
  }

  // Companies in scope for this admin — we won't write to any other company.
  // (Defence in depth on top of the ADMIN_MANAGE_USERS permission check.)
  const { data: assignmentRows } = await supabase
    .from("user_assignments")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  const adminWildcard = (assignmentRows || []).some(
    (r: { company_id: string | null }) => r.company_id === null
  );
  const adminCompanyIds = new Set(
    (assignmentRows || [])
      .map((r: { company_id: string | null }) => r.company_id)
      .filter((c: string | null): c is string => !!c)
  );

  // Group surviving pairs by the cashbook's company.
  const byCompany = new Map<string, Map<string, string[]>>();
  for (const { userId, cashbookId } of pairs) {
    const companyId = cashbookCompany.get(cashbookId);
    if (!companyId) continue; // unknown cashbook / wrong type
    if (!adminWildcard && !adminCompanyIds.has(companyId)) continue; // out of admin's scope

    if (!byCompany.has(companyId)) byCompany.set(companyId, new Map());
    const userMap = byCompany.get(companyId)!;
    const list = userMap.get(userId) ?? [];
    if (!list.includes(cashbookId)) list.push(cashbookId);
    userMap.set(userId, list);
  }

  // Determine which companies were *touched* by this request so we can also
  // overwrite their existing config when cashiers had every cashbook removed
  // from a company (otherwise stale entries would linger).
  const companiesTouched = new Set<string>();
  for (const cb of cashbookIds) {
    const c = cashbookCompany.get(cb);
    if (c && (adminWildcard || adminCompanyIds.has(c))) companiesTouched.add(c);
  }
  // Also include any companies the admin scopes that the original assignments
  // payload said something about (so emptying a cashier's list saves cleanly).
  // We approximate this by including every company in adminCompanyIds when
  // adminWildcard is false, or just keeping companiesTouched when wildcard.
  const targetCompanies: Set<string> = adminWildcard
    ? companiesTouched
    : new Set<string>([...companiesTouched, ...(Array.from(adminCompanyIds) as string[])]);

  // Upsert the new config_value for each touched company.
  for (const companyId of targetCompanies) {
    const userMap = byCompany.get(companyId) ?? new Map<string, string[]>();
    const cleaned: Record<string, string[]> = {};
    for (const [uid, ids] of userMap) cleaned[uid] = ids;

    const { error } = await supabase
      .from("company_configs")
      .upsert(
        {
          company_id: companyId,
          config_key: "cashier_cashbook_assignments",
          config_value: cleaned,
        },
        { onConflict: "company_id,config_key" }
      );
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  const totalLinks = pairs.length;
  const totalUsers = new Set(pairs.map((p) => p.userId)).size;
  return Response.json({
    success: true,
    message: `Saved ${totalLinks} cashbook link(s) across ${totalUsers} cashier(s) in ${targetCompanies.size} company(ies)`,
  });
}
