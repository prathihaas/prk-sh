import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  getUserAssignments,
  getAccessibleBranches,
} from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, TrendingUp, Receipt, Building2 } from "lucide-react";
import { ReportScopeSelector } from "./report-scope-selector";

export default async function ReportsPage({
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

  const hasReportingAccess =
    permissions.has(PERMISSIONS.REPORTING_BRANCH) ||
    permissions.has(PERMISSIONS.REPORTING_COMPANY) ||
    permissions.has(PERMISSIONS.REPORTING_GROUP);

  if (!hasReportingAccess) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reports"
          description="Select a company from the header to view reports"
        />
      </div>
    );
  }

  // Load accessible branches for the scope selector
  const branches = await getAccessibleBranches(supabase, assignments, companyId);

  const params = await searchParams;
  // "consolidated" = all branches, a branch ID = specific branch
  const selectedBranch = params.branch || "consolidated";

  const reportCards = [
    {
      title: "Cash Summary",
      description: "Daily cashbook balances, receipts and payments overview",
      href: `/reports/cash-summary?branch=${selectedBranch}`,
      icon: Banknote,
      iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    {
      title: "Revenue Report",
      description: "Invoice revenue, collections and outstanding analysis",
      href: `/reports/revenue?branch=${selectedBranch}`,
      icon: TrendingUp,
      iconClass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    {
      title: "Expense Report",
      description: "Expenses by category with approval status breakdown",
      href: `/reports/expenses?branch=${selectedBranch}`,
      icon: Receipt,
      iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    },
  ];

  const selectedBranchName =
    selectedBranch === "consolidated"
      ? "All Branches — Consolidated"
      : branches.find((b) => b.id === selectedBranch)?.name || "Selected Branch";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Financial and operational reports for your organisation"
      />

      {/* Branch / Consolidated Scope Selector */}
      <div className="flex items-center gap-3 flex-wrap rounded-lg border p-3 bg-muted/30">
        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-muted-foreground">Scope:</span>
          <Badge variant={selectedBranch === "consolidated" ? "default" : "secondary"}>
            {selectedBranchName}
          </Badge>
        </div>
        <ReportScopeSelector
          branches={branches}
          selectedBranch={selectedBranch}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reportCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconClass}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription className="text-xs">{card.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {selectedBranch === "consolidated" && branches.length > 1 && (
        <p className="text-xs text-muted-foreground">
          <strong>Consolidated</strong> — showing data across all {branches.length} branches.
          Use the selector above to filter by a specific branch.
        </p>
      )}
    </div>
  );
}
