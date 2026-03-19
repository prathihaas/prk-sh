import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getMinHierarchyLevel } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getDenominationConfig } from "@/lib/queries/company-configs";
import { getBranches } from "@/lib/queries/branches";
import { getCashbooks } from "@/lib/queries/cashbooks";
import { PageHeader } from "@/components/shared/page-header";
import { DenominationSettingsForm } from "./denomination-settings-form";

export default async function DenominationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, assignments] = await Promise.all([
    getUserPermissions(supabase, user.id),
    getUserAssignments(supabase, user.id),
  ]);

  if (!permissions.has(PERMISSIONS.ADMIN_CONFIGURE_APPROVAL)) redirect("/settings");

  const minHierarchy = getMinHierarchyLevel(assignments);
  const canEdit = minHierarchy <= 2;

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";

  if (!companyId) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Denomination Settings"
          description="Control whether cashiers must enter note-wise and coin-wise denomination count when closing a cashbook day."
        />
        <p className="text-sm text-muted-foreground">No company selected. Please select a company scope first.</p>
      </div>
    );
  }

  const [config, branches, cashbooks] = await Promise.all([
    getDenominationConfig(companyId),
    getBranches(companyId),
    getCashbooks(companyId),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Denomination Settings"
        description="Control whether cashiers must enter note-wise and coin-wise denomination count when closing a cashbook day."
      />
      <DenominationSettingsForm
        companyId={companyId}
        config={config}
        branches={(branches || []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
        cashbooks={(cashbooks || []).map((c: { id: string; name: string; type: string }) => ({ id: c.id, name: c.name, type: c.type }))}
        canEdit={canEdit}
      />
    </div>
  );
}
