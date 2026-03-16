import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCreditTransactions } from "@/lib/queries/credit-transactions";
import { getActiveCashbooksForUser } from "@/lib/queries/cashbooks";
import { PageHeader } from "@/components/shared/page-header";
import { formatINR } from "@/components/shared/currency-display";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditSettleButton } from "./credit-settle-button";

export default async function CreditTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ show_settled?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [permissions, params] = await Promise.all([
    getUserPermissions(supabase, user.id),
    searchParams,
  ]);

  if (!permissions.has(PERMISSIONS.REPORTING_BRANCH)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Credit Transactions"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  const showSettled = params.show_settled === "1";

  const [creditTxns, cashbooks] = await Promise.all([
    getCreditTransactions(companyId, branchId, showSettled),
    getActiveCashbooksForUser(companyId, branchId, user.id, 99),
  ]);

  const totalCredit = creditTxns
    .filter((t) => !t.settled_at)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Transactions"
        description="All credit-mode sales and receipts. Settle by linking a later payment."
      />

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outstanding Credit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-orange-600">
              {formatINR(totalCredit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {creditTxns.filter((t) => !t.settled_at).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Settled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-green-600">
              {creditTxns.filter((t) => t.settled_at).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <a
          href={showSettled ? "/reports/credit-transactions" : "/reports/credit-transactions?show_settled=1"}
          className="text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground"
        >
          {showSettled ? "Hide settled transactions" : "Show settled transactions"}
        </a>
      </div>

      {creditTxns.length === 0 ? (
        <div className="rounded-md border border-muted bg-muted/30 px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No credit transactions found.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Credit transactions appear when a sales receipt or payment receipt uses
            the &ldquo;Credit (Pay Later)&rdquo; payment mode.
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditTxns.map((txn) => (
                <TableRow
                  key={`${txn.source}-${txn.id}`}
                  className={txn.settled_at ? "opacity-60" : ""}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(txn.date).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="font-medium">{txn.party_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {txn.description}
                    {txn.invoice_number && (
                      <span className="ml-1 font-mono text-xs">
                        ({txn.invoice_number})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {txn.source === "invoice_payment"
                        ? "Sales Receipt"
                        : "Payment Receipt"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatINR(txn.amount)}
                  </TableCell>
                  <TableCell>
                    {txn.settled_at ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                        Settled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!txn.settled_at && txn.source === "invoice_payment" && (
                      <CreditSettleButton
                        invoicePaymentId={txn.id}
                        partyName={txn.party_name}
                        amount={txn.amount}
                        cashbooks={cashbooks.map((cb: { id: string; name: string }) => ({
                          id: cb.id,
                          name: cb.name,
                        }))}
                        companyId={companyId}
                        branchId={branchId || ""}
                        currentUserId={user.id}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
