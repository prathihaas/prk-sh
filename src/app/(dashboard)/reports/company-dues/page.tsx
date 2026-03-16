import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCompanyDues } from "@/lib/queries/company-dues";
import { PageHeader } from "@/components/shared/page-header";
import { formatINR } from "@/components/shared/currency-display";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DueMarkReceivedButton } from "./due-mark-received-button";
import type { CompanyDue } from "@/lib/queries/company-dues";

function DuesTable({
  dues,
  currentUserId,
}: {
  dues: CompanyDue[];
  currentUserId: string;
}) {
  if (dues.length === 0) {
    return (
      <div className="rounded-md border border-muted bg-muted/30 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No dues found for this category.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total (₹)</TableHead>
            <TableHead className="text-right">Received (₹)</TableHead>
            <TableHead className="text-right">Balance (₹)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dues.map((due) => (
            <TableRow key={due.id}>
              <TableCell className="font-medium">{due.company_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {due.invoice ? (
                  <div>
                    <p className="font-medium text-foreground">
                      {due.invoice.customer_name}
                    </p>
                    {due.invoice.dms_invoice_number && (
                      <p className="font-mono text-xs">
                        {due.invoice.dms_invoice_number}
                      </p>
                    )}
                    <p className="text-xs">
                      {new Date(due.invoice.invoice_date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {new Date(due.created_at).toLocaleDateString("en-IN")}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatINR(due.total_amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-green-700">
                {due.received_amount > 0 ? formatINR(due.received_amount) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-orange-700">
                {formatINR(due.balance_amount)}
              </TableCell>
              <TableCell>
                {due.status === "settled" ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                    Settled
                  </Badge>
                ) : due.status === "partial" ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                    Partial
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                    Pending
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {due.status !== "settled" && (
                  <DueMarkReceivedButton
                    dueId={due.id}
                    companyName={due.company_name}
                    balance={due.balance_amount}
                    receivedBy={currentUserId}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function CompanyDuesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.REPORTING_BRANCH)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Company Dues"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  const [insuranceDues, financeDues] = await Promise.all([
    getCompanyDues(companyId, branchId, { due_type: "insurance" }),
    getCompanyDues(companyId, branchId, { due_type: "finance" }),
  ]);

  const totalInsuranceBalance = insuranceDues.reduce(
    (sum, d) => sum + Number(d.balance_amount),
    0
  );
  const totalFinanceBalance = financeDues.reduce(
    (sum, d) => sum + Number(d.balance_amount),
    0
  );
  const pendingInsurance = insuranceDues.filter((d) => d.status !== "settled").length;
  const pendingFinance = financeDues.filter((d) => d.status !== "settled").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Dues"
        description="Receivables from insurance and finance companies. Track and mark amounts received."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Insurance Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-emerald-700">
              {formatINR(totalInsuranceBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingInsurance} record{pendingInsurance !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Finance Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-blue-700">
              {formatINR(totalFinanceBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingFinance} record{pendingFinance !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Receivable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-orange-700">
              {formatINR(totalInsuranceBalance + totalFinanceBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Settled All Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-green-700">
              {[...insuranceDues, ...financeDues].filter((d) => d.status === "settled").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="insurance">
        <TabsList>
          <TabsTrigger value="insurance">
            Insurance Dues
            {pendingInsurance > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs px-1.5 py-0.5">
                {pendingInsurance}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finance">
            Finance Dues
            {pendingFinance > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
                {pendingFinance}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insurance" className="mt-4">
          <DuesTable dues={insuranceDues} currentUserId={user.id} />
        </TabsContent>
        <TabsContent value="finance" className="mt-4">
          <DuesTable dues={financeDues} currentUserId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
