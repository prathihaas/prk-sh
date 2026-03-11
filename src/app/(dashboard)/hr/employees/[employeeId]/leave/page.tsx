import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getEmployee } from "@/lib/queries/employees";
import { getLeaveBalances } from "@/lib/queries/leave-balances";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaveBalanceEditor } from "./leave-balance-editor";

export default async function LeaveBalancePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.HR_MANAGE_EMPLOYEES)) redirect("/dashboard");
  let employee; try { employee = await getEmployee(employeeId); } catch { notFound(); }
  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const { data: fy } = await supabase.from("financial_years").select("id").eq("company_id", companyId!).eq("is_active", true).single();
  const balances = fy ? await getLeaveBalances(employeeId, fy.id) : [];
  return (<div className="space-y-6"><PageHeader title={`Leave Balances — ${employee.full_name}`} /><Card><CardHeader><CardTitle>Leave Balances</CardTitle></CardHeader><CardContent><LeaveBalanceEditor employeeId={employeeId} financialYearId={fy?.id || ""} balances={balances} /></CardContent></Card></div>);
}
