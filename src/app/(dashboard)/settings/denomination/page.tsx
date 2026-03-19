import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getMinHierarchyLevel } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getDenominationSetting } from "@/lib/queries/company-configs";
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
  const canEdit = minHierarchy <= 2; // Owner or Admin only

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const enabled = companyId ? await getDenominationSetting(companyId) : false;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Denomination Settings"
        description="Control whether cashiers must enter note-wise and coin-wise denomination count when closing a cashbook day."
      />
      <DenominationSettingsForm
        companyId={companyId}
        enabled={enabled}
        canEdit={canEdit}
      />
    </div>
  );
}
