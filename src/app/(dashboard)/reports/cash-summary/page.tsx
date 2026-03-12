import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getAccessibleBranches,
} from "@/lib/auth/helpers";
import { getCashSummary } from "@/lib/queries/reports";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Banknote, ArrowDownCircle, ArrowUpCircle, Wallet, Building2, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/shared/export-button";
import { ReportScopeSelector } from "../report-scope-selector";

const EXPORT_COLUMNS = [
  { key: "day_date", header: "Date", width: 14, format: "date" as const },
  { key: "cashbook_name", header: "Cashbook", width: 24 },
  { key: "opening_balance", header: "Opening Balance", width: 18, format: "currency" as const },
  { key: "total_receipts", header: "Receipts", width: 16, format: "currency" as const },
  { key: "total_payments", header: "Payments", width: 16, format: "currency" as const },
  { key: "closing_balance", header: "Closing Balance", width: 18, format: "currency" as const },
  { key: "status", header: "Status", width: 12 },
];

export default async function CashSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, assignments] = await Promise.all([
    getUserPermissions(supabase, user.id),
    getUserAssignments(supabase, user.id),
  ]);

  const hasAccess =
    permissions.has(PERMISSIONS.REPORTING_BRANCH) ||
    permissions.has(PERMISSIONS.REPORTING_COMPANY);
  if (!hasAccess) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cash Summary" description="Select a company from the header" />
      </div>
    );
  }

  const branches = await getAccessibleBranches(supabase, assignments, companyId);
  const params = await searchParams;
  const selectedBranch = params.branch || "consolidated";

  const branchIdFilter = selectedBranch === "consolidated" ? null : selectedBranch;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cashDays: any[] = [];
  try {
    cashDays = await getCashSummary(companyId, branchIdFilter) as any[];
  } catch (err) {
    console.error("Failed to load cash summary:", err);
    return (
      <div className="space-y-6">
        <PageHeader title="Cash Summary" description="Daily cashbook balances and transaction overview" />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950">
          <strong>Error loading cash summary.</strong> Please refresh the page or contact support.
        </div>
      </div>
    );
  }

  const totalReceipts = cashDays.reduce((sum: number, d) => sum + (d.total_receipts || 0), 0);
  const totalPayments = cashDays.reduce((sum: number, d) => sum + (d.total_payments || 0), 0);
  const netPosition = totalReceipts - totalPayments;

  const selectedBranchName =
    selectedBranch === "consolidated"
      ? "All Branches — Consolidated"
      : branches.find((b) => b.id === selectedBranch)?.name || "Branch";

  const exportData = cashDays.map((d) => ({
    ...d,
    cashbook_name: (d.cashbook as { name: string } | null)?.name || "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/reports?branch=${selectedBranch}`}>
            <ChevronLeft className="h-4 w-4 mr-1" /> All Reports
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader title="Cash Summary" description="Daily cashbook balances and transaction overview" />
        <ExportButton
          data={exportData as Record<string, unknown>[]}
          columns={EXPORT_COLUMNS}
          filename={`cash_summary_${selectedBranch}_${new Date().toISOString().split("T")[0]}`}
          label="Export"
        />
      </div>

      {/* Scope bar */}
      <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30 flex-wrap">
        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-muted-foreground">Scope:</span>
          <Badge variant={selectedBranch === "consolidated" ? "default" : "secondary"}>
            {selectedBranchName}
          </Badge>
        </div>
        <ReportScopeSelector branches={branches} selectedBranch={selectedBranch} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Receipts", value: formatINR(totalReceipts), icon: ArrowDownCircle, color: "text-green-600" },
          { title: "Total Payments", value: formatINR(totalPayments), icon: ArrowUpCircle, color: "text-red-600" },
          { title: "Net Position", value: formatINR(netPosition), icon: Wallet, color: netPosition >= 0 ? "text-green-600" : "text-red-600" },
          { title: "Days Recorded", value: String(cashDays.length), icon: Banknote, color: "" },
        ].map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Daily Cashbook Entries</CardTitle></CardHeader>
        <CardContent>
          {cashDays.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No cashbook day entries found.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Cashbook</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Receipts</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashDays.map((day, idx) => {
                    const cashbook = day.cashbook as { name: string } | null;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {new Date(day.day_date).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell>{cashbook?.name || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(day.opening_balance)}</TableCell>
                        <TableCell className="text-right tabular-nums text-green-600">{formatINR(day.total_receipts)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">{formatINR(day.total_payments)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatINR(day.closing_balance)}</TableCell>
                        <TableCell><StatusBadge status={day.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
