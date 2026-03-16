import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getMinHierarchyLevel } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCashLimits } from "@/lib/queries/company-configs";
import { PageHeader } from "@/components/shared/page-header";
import { CashLimitsForm } from "./cash-limits-form";

export default async function CashLimitsPage() {
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
  const limits = companyId ? await getCashLimits(companyId) : { customer_cash_per_fy: 200000, expense_cash_per_payment: 10000 };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Cash Limit Controls"
        description="Configure maximum cash transaction limits as required by Indian Income Tax law."
      />
      <CashLimitsForm
        companyId={companyId}
        limits={limits}
        canEdit={canEdit}
      />
    </div>
  );
}
