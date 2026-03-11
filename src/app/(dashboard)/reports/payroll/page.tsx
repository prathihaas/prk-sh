import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getPayrollSummary } from "@/lib/queries/reports";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Banknote, MinusCircle, Wallet } from "lucide-react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function PayrollReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  const hasAccess =
    permissions.has(PERMISSIONS.REPORTING_BRANCH) ||
    permissions.has(PERMISSIONS.REPORTING_COMPANY);
  if (!hasAccess) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payroll Report"
          description="Select a company from the header to view payroll report"
        />
      </div>
    );
  }

  const runs = await getPayrollSummary(companyId, branchId);

  const totalGross = runs.reduce((sum: number, r: any) => sum + (r.total_gross || 0), 0);
  const totalDeductions = runs.reduce(
    (sum: number, r: any) => sum + (r.total_deductions || 0),
    0
  );
  const totalNet = runs.reduce((sum: number, r: any) => sum + (r.total_net || 0), 0);

  const summaryCards = [
    {
      title: "Total Gross",
      value: formatINR(totalGross),
      icon: Banknote,
    },
    {
      title: "Total Deductions",
      value: formatINR(totalDeductions),
      icon: MinusCircle,
    },
    {
      title: "Total Net",
      value: formatINR(totalNet),
      icon: Wallet,
    },
    {
      title: "Payroll Runs",
      value: runs.length.toString(),
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Report"
        description="Monthly payroll runs with gross, deductions, and net summary"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No payroll runs found.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run: any) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {MONTH_NAMES[run.month - 1]} {run.year}
                      </TableCell>
                      <TableCell className="text-right">
                        {run.employee_count ?? "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(run.total_gross)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(run.total_deductions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(run.total_net)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
