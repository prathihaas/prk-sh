import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, getUserAssignments, getMinHierarchyLevel } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getInsuranceCompanies, getFinanceCompanies } from "@/lib/queries/company-configs";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyPartnersForm } from "./company-partners-form";

export default async function CompanyPartnersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const [insuranceCompanies, financeCompanies] = companyId
    ? await Promise.all([
        getInsuranceCompanies(companyId),
        getFinanceCompanies(companyId),
      ])
    : [[], []];

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Company Partners"
        description="Manage insurance and finance company names used in sales receipts."
      />
      <CompanyPartnersForm
        companyId={companyId}
        insuranceCompanies={insuranceCompanies}
        financeCompanies={financeCompanies}
        canEdit={canEdit}
      />
    </div>
  );
}
