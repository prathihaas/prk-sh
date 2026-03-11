import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PayrollRunForm } from "@/components/forms/payroll-run-form";

export default async function NewPayrollRunPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PAYROLL_PROCESS)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;
  if (!companyId || !branchId) redirect("/hr/payroll");

  return (
    <div className="space-y-6">
      <PayrollRunForm
        companyId={companyId}
        branchId={branchId}
        currentUserId={user.id}
      />
    </div>
  );
}
