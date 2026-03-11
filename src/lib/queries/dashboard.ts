import type { SupabaseClient } from "@supabase/supabase-js";

export async function getDashboardMetrics(supabase: SupabaseClient) {
  const [companiesRes, branchesRes, usersRes, fyRes] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("financial_years")
      .select("label, is_locked")
      .eq("is_active", true)
      .eq("is_locked", false)
      .order("start_date", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    totalCompanies: companiesRes.count || 0,
    totalBranches: branchesRes.count || 0,
    totalUsers: usersRes.count || 0,
    currentFY: fyRes.data?.label || "Not set",
    fyLocked: fyRes.data?.is_locked || false,
  };
}
