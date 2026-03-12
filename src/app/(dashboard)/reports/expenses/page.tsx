import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getAccessibleBranches,
} from "@/lib/auth/helpers";
import { getExpenseSummary } from "@/lib/queries/reports";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Receipt, CheckCircle2, Clock, BarChart3, Building2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/shared/export-button";
import { ReportScopeSelector } from "../report-scope-selector";

const EXPORT_COLUMNS = [
  { key: "expense_date", header: "Date", width: 14, format: "date" as const },
  { key: "category_name", header: "Category", width: 22 },
  { key: "amount", header: "Amount (INR)", width: 16, format: "currency" as const },
  { key: "approval_status", header: "Status", width: 20 },
];

export default async function ExpenseReportPage({
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
        <PageHeader title="Expense Report" description="Select a company from the header" />
      </div>
    );
  }

  const branches = await getAccessibleBranches(supabase, assignments, companyId);
  const params = await searchParams;
  const selectedBranch = params.branch || "consolidated";

  const branchIdFilter = selectedBranch === "consolidated" ? null : selectedBranch;

  let expenses: any[] = [];
  let summary = { totalExpenses: 0, approvedExpenses: 0, pendingExpenses: 0, count: 0 };
  try {
    const result = await getExpenseSummary(companyId, branchIdFilter);
    expenses = result.expenses as any[];
    summary = result.summary;
  } catch (err) {
    console.error("Failed to load expense summary:", err);
    return (
      <div className="space-y-6">
        <PageHeader title="Expense Report" description="Expense tracking with category breakdown and approval status" />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950">
          <strong>Error loading expense report.</strong> Please refresh the page or contact support.
        </div>
      </div>
    );
  }

  const selectedBranchName =
    selectedBranch === "consolidated"
      ? "All Branches — Consolidated"
      : branches.find((b) => b.id === selectedBranch)?.name || "Branch";

  // Category breakdown
  const categoryMap = new Map<string, { name: string; total: number; count: number }>();
  for (const exp of expenses) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName = ((exp as any).category as { name: string } | null)?.name || "Uncategorized";
    const existing = categoryMap.get(catName) || { name: catName, total: 0, count: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existing.total += (exp as any).amount || 0;
    existing.count += 1;
    categoryMap.set(catName, existing);
  }
  const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

  // Flatten for export
  const exportData = (expenses as Record<string, unknown>[]).map((exp) => ({
    ...exp,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category_name: ((exp as any).category as { name: string } | null)?.name || "",
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
        <PageHeader title="Expense Report" description="Expense tracking with category breakdown and approval status" />
        <ExportButton
          data={exportData as Record<string, unknown>[]}
          columns={EXPORT_COLUMNS}
          filename={`expense_report_${selectedBranch}_${new Date().toISOString().split("T")[0]}`}
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
          { title: "Total Expenses", value: formatINR(summary.totalExpenses), icon: Receipt, color: "" },
          { title: "Approved & Paid", value: formatINR(summary.approvedExpenses), icon: CheckCircle2, color: "text-green-600" },
          { title: "Pending Approval", value: formatINR(summary.pendingExpenses), icon: Clock, color: "text-orange-600" },
          { title: "Entries", value: String(summary.count), icon: BarChart3, color: "" },
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No expense data available.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryBreakdown.map((cat) => (
                      <TableRow key={cat.name}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-right">{cat.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(cat.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Expenses</CardTitle></CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No expenses found.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {expenses.slice(0, 20).map((exp: any) => {
                      const category = exp.category as { name: string } | null;
                      return (
                        <TableRow key={exp.id}>
                          <TableCell>
                            {new Date(exp.expense_date).toLocaleDateString("en-IN")}
                          </TableCell>
                          <TableCell>{category?.name || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(exp.amount)}</TableCell>
                          <TableCell><StatusBadge status={exp.approval_status} /></TableCell>
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
    </div>
  );
}
