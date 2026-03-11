import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getEmployees } from "@/lib/queries/employees";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.HR_MANAGE_EMPLOYEES)) redirect("/dashboard");
  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;
  if (!companyId) return (<div className="space-y-6"><PageHeader title="Employees" description="Select a company from the header" /></div>);
  const employees = await getEmployees(companyId, branchId);
  return (<div className="space-y-6"><PageHeader title="Employees" description="Manage employee records" action={{ label: "Add Employee", href: "/hr/employees/new" }} /><DataTable columns={columns} data={employees} emptyMessage="No employees found" /></div>);
}
