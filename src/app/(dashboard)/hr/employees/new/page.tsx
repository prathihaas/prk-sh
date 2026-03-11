import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { EmployeeForm } from "@/components/forms/employee-form";

export default async function NewEmployeePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.HR_MANAGE_EMPLOYEES)) redirect("/dashboard");
  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;
  if (!companyId || !branchId) redirect("/hr/employees");
  return (<div className="space-y-6"><EmployeeForm companyId={companyId} branchId={branchId} /></div>);
}
