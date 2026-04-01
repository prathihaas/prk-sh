import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { getAttendancePeriods } from "@/lib/queries/attendance";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.HR_MARK_ATTENDANCE)) redirect("/dashboard");
  const cookieStore = await cookies();
  const branchId = cookieStore.get("scope_branch_id")?.value;
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );
  if (!companyId) return (<div className="space-y-6"><PageHeader title="Attendance" description="Select a company from the header" /></div>);
  const periods = await getAttendancePeriods(companyId, branchId);
  return (<div className="space-y-6"><PageHeader title="Attendance" description="Monthly attendance tracking" action={{ label: "New Period", href: "/hr/attendance/new" }} /><DataTable columns={columns} data={periods} emptyMessage="No attendance periods found" /></div>);
}
