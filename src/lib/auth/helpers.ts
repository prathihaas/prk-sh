import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile, UserAssignment } from "@/types/auth";

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

/**
 * Fetch user profile from user_profiles table
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Fetch all active assignments for a user with joined role data
 */
export async function getUserAssignments(
  supabase: SupabaseClient,
  userId: string
): Promise<UserAssignment[]> {
  // In mock mode, the mock client already has the role data embedded in assignments
  if (isMockMode) {
    const { data, error } = await supabase
      .from("user_assignments")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching user assignments:", error);
      return [];
    }
    return (data || []) as unknown as UserAssignment[];
  }

  const { data, error } = await supabase
    .from("user_assignments")
    .select(
      `
      id,
      user_id,
      role_id,
      group_id,
      company_id,
      branch_id,
      is_active,
      assigned_at,
      role:roles (
        id,
        name,
        description,
        hierarchy_level
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching user assignments:", error);
    return [];
  }

  return (data || []) as unknown as UserAssignment[];
}

/**
 * Build a Set of "module:action" permission strings for a user.
 * Merges role-based permissions with per-user permission overrides stored in
 * company_configs (config_key = "user_permission_overrides").
 */
export async function getUserPermissions(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  // In mock mode, return all permissions (Group Owner has everything)
  if (isMockMode) {
    const { mockPermissions } = await import("@/lib/mock/data");
    return new Set(mockPermissions);
  }

  const { data, error } = await supabase
    .from("user_assignments")
    .select(
      `
      company_id,
      role:roles (
        role_permissions (
          permission:permissions (
            module,
            action
          )
        )
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching user permissions:", error);
    return new Set();
  }

  const permissions = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data || []).forEach((assignment: any) => {
    const role = assignment.role;
    if (role && role.role_permissions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role.role_permissions.forEach((rp: any) => {
        if (rp.permission) {
          permissions.add(`${rp.permission.module}:${rp.permission.action}`);
        }
      });
    }
  });

  // Also check per-user permission overrides stored in company_configs
  // These are granted by admins via the User Access Controls settings page
  const companyIds = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...new Set((data || []).map((a: any) => a.company_id).filter(Boolean)),
  ] as string[];

  if (companyIds.length > 0) {
    const { data: overrideConfigs } = await supabase
      .from("company_configs")
      .select("config_value")
      .in("company_id", companyIds)
      .eq("config_key", "user_permission_overrides");

    for (const cfg of overrideConfigs || []) {
      try {
        const overrides: Record<string, string[]> = typeof cfg.config_value === "object"
          ? (cfg.config_value as Record<string, string[]>)
          : JSON.parse(String(cfg.config_value));
        const userOverrides = overrides[userId];
        if (Array.isArray(userOverrides)) {
          userOverrides.forEach((perm) => permissions.add(perm));
        }
      } catch {
        // Malformed override config, skip
      }
    }
  }

  return permissions;
}

/**
 * Get the minimum hierarchy level for a user (lower = more powerful)
 */
export function getMinHierarchyLevel(assignments: UserAssignment[]): number {
  if (assignments.length === 0) return 99;
  return Math.min(...assignments.map((a) => a.role.hierarchy_level));
}

/**
 * Get the group_id from user assignments (all assignments share the same group)
 */
export function getUserGroupId(assignments: UserAssignment[]): string | null {
  if (assignments.length === 0) return null;
  return assignments[0].group_id;
}

/**
 * Get accessible company IDs from assignments
 * If any assignment has company_id = null, user has access to all companies
 */
export async function getAccessibleCompanies(
  supabase: SupabaseClient,
  assignments: UserAssignment[]
): Promise<{ id: string; name: string; code: string }[]> {
  if (assignments.length === 0) return [];

  const groupId = assignments[0].group_id;

  // If any assignment has company_id = null, user can see all companies in the group
  const hasWildcardCompany = assignments.some((a) => a.company_id === null);

  if (hasWildcardCompany) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, code")
      .eq("group_id", groupId)
      .eq("is_active", true)
      .order("name");

    return data || [];
  }

  // Otherwise, only the specific companies
  const companyIds = [
    ...new Set(assignments.map((a) => a.company_id).filter(Boolean)),
  ];

  if (companyIds.length === 0) return [];

  const { data } = await supabase
    .from("companies")
    .select("id, name, code")
    .in("id", companyIds as string[])
    .eq("is_active", true)
    .order("name");

  return data || [];
}

/**
 * Resolve the active company scope from the cookie, with a fallback to the
 * first accessible company when no cookie is set (e.g. first-ever page load
 * before ScopeProvider has written the cookie via JS).
 *
 * Pass preloadedAssignments if you have already fetched them to avoid a
 * redundant DB round-trip.
 */
export async function resolveCompanyScope(
  supabase: SupabaseClient,
  userId: string,
  cookieValue?: string | null,
  preloadedAssignments?: UserAssignment[]
): Promise<string | null> {
  if (cookieValue) return cookieValue;

  const assignments =
    preloadedAssignments ?? (await getUserAssignments(supabase, userId));
  const companies = await getAccessibleCompanies(supabase, assignments);
  return companies[0]?.id ?? null;
}

/**
 * Get accessible branches for a selected company
 */
export async function getAccessibleBranches(
  supabase: SupabaseClient,
  assignments: UserAssignment[],
  companyId: string
): Promise<{ id: string; name: string; code: string; company_id: string }[]> {
  if (assignments.length === 0) return [];

  // If any assignment has branch_id = null for this company (or wildcard company), get all branches
  const hasWildcardBranch = assignments.some(
    (a) =>
      a.branch_id === null &&
      (a.company_id === null || a.company_id === companyId)
  );

  if (hasWildcardBranch) {
    const { data } = await supabase
      .from("branches")
      .select("id, name, code, company_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");

    return data || [];
  }

  // Only specific branches
  const branchIds = [
    ...new Set(
      assignments
        .filter(
          (a) => a.company_id === companyId || a.company_id === null
        )
        .map((a) => a.branch_id)
        .filter(Boolean)
    ),
  ];

  if (branchIds.length === 0) return [];

  const { data } = await supabase
    .from("branches")
    .select("id, name, code, company_id")
    .in("id", branchIds as string[])
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  return data || [];
}
