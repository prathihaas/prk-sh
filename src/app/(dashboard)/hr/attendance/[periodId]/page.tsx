import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getAttendancePeriod, getAttendanceRecords } from "@/lib/queries/attendance";
import { getEmployees } from "@/lib/queries/employees";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { AttendanceGrid } from "@/components/forms/attendance-grid";
import { PeriodActions } from "./period-actions";

const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function AttendancePeriodDetailPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.HR_MARK_ATTENDANCE)) redirect("/dashboard");
  let period; try { period = await getAttendancePeriod(periodId); } catch { notFound(); }
  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;
  const employees = await getEmployees(companyId!, branchId, "active");
  const records = await getAttendanceRecords(periodId);
  return (<div className="space-y-6">
    <PageHeader title={`Attendance — ${MONTH_NAMES[period.month]} ${period.year}`} description={`Status: ${period.status}`} />
    <PeriodActions periodId={periodId} status={period.status} canClose={permissions.has(PERMISSIONS.HR_CLOSE_ATTENDANCE)} />
    <AttendanceGrid periodId={periodId} month={period.month} year={period.year} employees={employees} records={records} isEditable={period.status === "open"} />
  </div>);
}
