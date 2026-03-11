import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getPayrollRun, getPayrollEntries } from "@/lib/queries/payroll";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { entriesColumns } from "./entries-columns";
import { RunActions } from "./run-actions";

const MN = [
  "",
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

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PAYROLL_PROCESS)) redirect("/dashboard");

  let run;
  try {
    run = await getPayrollRun(runId);
  } catch {
    notFound();
  }

  const entries = await getPayrollEntries(runId);

  return (
    <div className="space-y-6">
      <PageHeader title={`Payroll \u2014 ${MN[run.month]} ${run.year}`} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={run.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold tabular-nums">
              {formatINR(run.total_gross)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold tabular-nums text-red-600">
              {formatINR(run.total_deductions)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold tabular-nums text-green-600">
              {formatINR(run.total_net)}
            </span>
          </CardContent>
        </Card>
      </div>

      <RunActions
        runId={runId}
        status={run.status}
        canProcess={permissions.has(PERMISSIONS.PAYROLL_PROCESS)}
        canLock={permissions.has(PERMISSIONS.PAYROLL_LOCK)}
        canReopen={permissions.has(PERMISSIONS.PAYROLL_REOPEN)}
      />

      <DataTable
        columns={entriesColumns}
        data={entries}
        emptyMessage="No entries. Process payroll first."
      />
    </div>
  );
}
