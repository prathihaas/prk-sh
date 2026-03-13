import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getAccessibleBranches,
} from "@/lib/auth/helpers";
import { getRevenueSummary } from "@/lib/queries/reports";
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
  TrendingUp, IndianRupee, CircleDollarSign, FileText, Building2, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/shared/export-button";
import { ReportScopeSelector } from "../report-scope-selector";

const EXPORT_COLUMNS = [
  { key: "dms_invoice_number", header: "Invoice #", width: 18 },
  { key: "invoice_date", header: "Date", width: 14, format: "date" as const },
  { key: "customer_name", header: "Customer", width: 28 },
  { key: "grand_total", header: "Total Amount", width: 18, format: "currency" as const },
  { key: "balance_due", header: "Balance Due", width: 18, format: "currency" as const },
  { key: "approval_status", header: "Status", width: 14 },
];

export default async function RevenuePage({
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
        <PageHeader title="Revenue Report" description="Select a company from the header" />
      </div>
    );
  }

  const branches = await getAccessibleBranches(supabase, assignments, companyId);
  const params = await searchParams;
  const selectedBranch = params.branch || "consolidated";

  const branchIdFilter = selectedBranch === "consolidated" ? null : selectedBranch;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let invoices: any[] = [];
  let summary = { totalRevenue: 0, totalOutstanding: 0, totalCollected: 0, count: 0 };
  try {
    const result = await getRevenueSummary(companyId, branchIdFilter);
    invoices = result.invoices as any[];
    summary = result.summary;
  } catch (err) {
    console.error("Failed to load revenue summary:", err);
    return (
      <div className="space-y-6">
        <PageHeader title="Revenue Report" description="Invoice revenue, collections and outstanding analysis" />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950">
          <strong>Error loading revenue report.</strong> Please refresh the page or contact support.
        </div>
      </div>
    );
  }

  const selectedBranchName =
    selectedBranch === "consolidated"
      ? "All Branches — Consolidated"
      : branches.find((b) => b.id === selectedBranch)?.name || "Branch";

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
        <PageHeader title="Revenue Report" description="Invoice revenue, collections and outstanding analysis" />
        <ExportButton
          data={invoices as Record<string, unknown>[]}
          columns={EXPORT_COLUMNS}
          filename={`revenue_report_${selectedBranch}_${new Date().toISOString().split("T")[0]}`}
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
          { title: "Total Revenue", value: formatINR(summary.totalRevenue), icon: TrendingUp, color: "" },
          { title: "Collected", value: formatINR(summary.totalCollected), icon: IndianRupee, color: "text-green-600" },
          { title: "Outstanding", value: formatINR(summary.totalOutstanding), icon: CircleDollarSign, color: "text-orange-600" },
          { title: "Invoices", value: String(summary.count), icon: FileText, color: "" },
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
        <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No invoices found.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.dms_invoice_number || "—"}</TableCell>
                      <TableCell>{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell>{inv.customer_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(inv.grand_total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-orange-600">{formatINR(inv.balance_due)}</TableCell>
                      <TableCell><StatusBadge status={inv.approval_status} /></TableCell>
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
