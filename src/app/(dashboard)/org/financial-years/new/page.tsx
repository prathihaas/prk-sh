import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { FinancialYearForm } from "@/components/forms/financial-year-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function NewFinancialYearPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_LOCK_FY)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  if (!companyId) redirect("/org/financial-years");

  return (
    <div className="space-y-6">
      <PageHeader title="Create Financial Year" />
      <FinancialYearForm companyId={companyId} />
    </div>
  );
}
