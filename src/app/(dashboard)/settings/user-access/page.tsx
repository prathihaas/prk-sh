import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getUserGroupId,
} from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { UserAccessManager } from "./user-access-manager";

// Cashier hierarchy level — these users get cashbook-specific assignment
const CASHIER_HIERARCHY_LEVEL = 5;

export default async function UserAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS)) redirect("/settings");

  const adminAssignments = await getUserAssignments(supabase, user.id);
  const groupId = getUserGroupId(adminAssignments);

  if (!groupId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Access Controls"
          description="Could not determine your group — please contact support."
        />
      </div>
    );
  }

  // ── Load all companies in the group ──────────────────────────────────
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, code")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("name");

  // ── Load all branches for each company ───────────────────────────────
  const companyIds = (companies || []).map((c: { id: string }) => c.id);
  const { data: allBranches } = companyIds.length > 0
    ? await supabase
        .from("branches")
        .select("id, name, code, company_id")
        .in("company_id", companyIds)
        .eq("is_active", true)
        .order("name")
    : { data: [] };

  // ── Load all roles ────────────────────────────────────────────────────
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, hierarchy_level")
    .order("hierarchy_level");

  // ── Load all active user assignments in the group ─────────────────────
  const { data: existingAssignments } = await supabase
    .from("user_assignments")
    .select(`
      id,
      user_id,
      role_id,
      company_id,
      branch_id,
      is_active,
      user:user_profiles!user_assignments_user_id_fkey(id, full_name, email),
      role:roles!user_assignments_role_id_fkey(id, name, hierarchy_level)
    `)
    .eq("group_id", groupId)
    .eq("is_active", true);

  // ── Load telegram_chat_id for all users in group ─────────────────────
  const allUserIds = Array.from(
    new Set((existingAssignments || []).map((a: { user_id: string }) => a.user_id))
  );
  const { data: telegramProfiles } = allUserIds.length > 0
    ? await supabase
        .from("user_profiles")
        .select("id, telegram_chat_id")
        .in("id", allUserIds)
    : { data: [] };

  const telegramChatIds: Record<string, string | null> = {};
  for (const p of (telegramProfiles || []) as Array<{ id: string; telegram_chat_id: string | null }>) {
    telegramChatIds[p.id] = p.telegram_chat_id;
  }

  // Collect unique users and their current access map
  const usersMap = new Map<
    string,
    {
      id: string;
      full_name: string | null;
      email: string | null;
      minHierarchy: number;
      currentRoleId: string | null;
      companyAssignments: Map<string, Set<string | null>>;
    }
  >();

  for (const a of (existingAssignments || []) as Array<{
    user_id: string;
    role_id: string;
    company_id: string | null;
    branch_id: string | null;
    user: { id: string; full_name: string | null; email: string | null } | null;
    role: { id: string; name: string; hierarchy_level: number } | null;
  }>) {
    const u = a.user;
    const r = a.role;
    if (!u) continue;

    const hl = r?.hierarchy_level ?? 99;

    if (!usersMap.has(u.id)) {
      usersMap.set(u.id, {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        minHierarchy: hl,
        currentRoleId: a.role_id,
        companyAssignments: new Map(),
      });
    } else {
      const existing = usersMap.get(u.id)!;
      if (hl < existing.minHierarchy) {
        existing.minHierarchy = hl;
        existing.currentRoleId = a.role_id;
      }
    }

    const userData = usersMap.get(u.id)!;
    if (a.company_id) {
      if (!userData.companyAssignments.has(a.company_id)) {
        userData.companyAssignments.set(a.company_id, new Set());
      }
      userData.companyAssignments.get(a.company_id)!.add(a.branch_id);
    }
  }

  // Serialize for client (no Map/Set)
  const users = Array.from(usersMap.values())
    .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""))
    .map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      minHierarchy: u.minHierarchy,
      currentRoleId: u.currentRoleId,
      companyAccess: Object.fromEntries(
        Array.from(u.companyAssignments.entries()).map(([cId, branchSet]) => [
          cId,
          Array.from(branchSet),
        ])
      ) as Record<string, (string | null)[]>,
    }));

  const cashierUsers = users.filter((u) => u.minHierarchy >= CASHIER_HIERARCHY_LEVEL);

  // ── Cashbooks (for cashier assignment) ───────────────────────────────
  const { data: cashbooks } = companyIds.length > 0
    ? await supabase
        .from("cashbooks")
        .select("id, name, type, branch_id, company_id")
        .in("company_id", companyIds)
        .in("type", ["main", "petty"])
        .eq("is_active", true)
        .order("name")
    : { data: [] };

  // ── Cashbook assignments (merged across companies) ────────────────────
  const { data: cashbookConfigs } = companyIds.length > 0
    ? await supabase
        .from("company_configs")
        .select("company_id, config_value")
        .in("company_id", companyIds)
        .eq("config_key", "cashier_cashbook_assignments")
    : { data: [] };

  const mergedCashierAssignments: Record<string, string> = {};
  for (const cfg of cashbookConfigs || []) {
    try {
      const val = typeof cfg.config_value === "object" && !Array.isArray(cfg.config_value)
        ? (cfg.config_value as Record<string, string>)
        : JSON.parse(String(cfg.config_value));
      Object.assign(mergedCashierAssignments, val);
    } catch { /* skip */ }
  }

  // ── Permission overrides ──────────────────────────────────────────────
  const { data: overrideConfigs } = companyIds.length > 0
    ? await supabase
        .from("company_configs")
        .select("company_id, config_value")
        .in("company_id", companyIds)
        .eq("config_key", "user_permission_overrides")
    : { data: [] };

  const mergedOverrides: Record<string, string[]> = {};
  for (const cfg of overrideConfigs || []) {
    try {
      const val = typeof cfg.config_value === "object" && !Array.isArray(cfg.config_value)
        ? (cfg.config_value as Record<string, string[]>)
        : JSON.parse(String(cfg.config_value));
      for (const [uid, perms] of Object.entries(val)) {
        if (Array.isArray(perms)) {
          mergedOverrides[uid] = Array.from(new Set([...(mergedOverrides[uid] || []), ...perms]));
        }
      }
    } catch { /* skip */ }
  }

  const primaryCompanyId = companyIds[0] || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Access Controls"
        description="Manage what each user can see — assign companies, branches, roles, and special permissions"
      />
      <UserAccessManager
        groupId={groupId}
        users={users}
        cashierUsers={cashierUsers}
        companies={companies || []}
        branches={allBranches || []}
        roles={(roles || []).map((r: { id: string; name: string; hierarchy_level: number }) => ({
          id: r.id,
          name: r.name,
          hierarchy_level: r.hierarchy_level,
        }))}
        cashbooks={(cashbooks || []).map((c: { id: string; name: string; type: string; branch_id: string | null; company_id: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          branch_id: c.branch_id as string | null,
          company_id: c.company_id as string,
        }))}
        initialOverrides={mergedOverrides}
        initialCashierAssignments={mergedCashierAssignments}
        initialTelegramChatIds={telegramChatIds}
        primaryCompanyId={primaryCompanyId}
      />
    </div>
  );
}
