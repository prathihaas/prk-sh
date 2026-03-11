import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getUserProfile,
  getUserAssignments,
  getUserPermissions,
  getUserGroupId,
  getAccessibleCompanies,
} from "@/lib/auth/helpers";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ScopeProvider } from "@/components/providers/scope-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user data in parallel
  const [profile, assignments, permissions] = await Promise.all([
    getUserProfile(supabase, user.id),
    getUserAssignments(supabase, user.id),
    getUserPermissions(supabase, user.id),
  ]);

  if (!profile) {
    redirect("/login");
  }

  // Get scope data
  const groupId = getUserGroupId(assignments);
  const companies = await getAccessibleCompanies(supabase, assignments);

  // Get all branches for all accessible companies (for the scope provider)
  let allBranches: { id: string; name: string; code: string; company_id: string }[] = [];
  if (companies.length > 0) {
    const { data } = await supabase
      .from("branches")
      .select("id, name, code, company_id")
      .in(
        "company_id",
        companies.map((c) => c.id)
      )
      .eq("is_active", true)
      .order("name");
    allBranches = data || [];
  }

  // Read persisted scope from cookies
  const cookieStore = await cookies();
  const savedCompanyId = cookieStore.get("scope_company_id")?.value || null;
  const savedBranchId = cookieStore.get("scope_branch_id")?.value || null;

  // Validate saved scope against accessible data
  const initialCompanyId =
    savedCompanyId && companies.some((c) => c.id === savedCompanyId)
      ? savedCompanyId
      : companies.length > 0
        ? companies[0].id
        : null;

  const initialBranchId =
    savedBranchId && allBranches.some((b) => b.id === savedBranchId)
      ? savedBranchId
      : null;

  return (
    <AuthProvider
      user={profile}
      assignments={assignments}
      permissions={Array.from(permissions)}
    >
      <ScopeProvider
        groupId={groupId}
        initialCompanyId={initialCompanyId}
        initialBranchId={initialBranchId}
        companies={companies}
        allBranches={allBranches}
      >
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader />
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </SidebarProvider>
      </ScopeProvider>
    </AuthProvider>
  );
}
