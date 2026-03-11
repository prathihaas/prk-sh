import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AttendancePeriodForm } from "@/components/forms/attendance-period-form";

export default async function NewAttendancePeriodPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.HR_MARK_ATTENDANCE)) redirect("/dashboard");
  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;
  if (!companyId || !branchId) redirect("/hr/attendance");
  return (<div className="space-y-6"><AttendancePeriodForm companyId={companyId} branchId={branchId} /></div>);
}
