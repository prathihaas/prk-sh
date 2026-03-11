import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import {
  getTransaction,
  getTransactionRevisions,
} from "@/lib/queries/cashbook-transactions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { VoidTransactionForm } from "@/components/forms/void-transaction-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{
    cashbookId: string;
    dayId: string;
    transactionId: string;
  }>;
}) {
  const { transactionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  let txn;
  try {
    txn = await getTransaction(transactionId);
  } catch {
    notFound();
  }

  const revisions = await getTransactionRevisions(transactionId);
  const canVoid =
    !txn.is_voided && permissions.has(PERMISSIONS.CASHBOOK_VOID_TXN);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Transaction ${txn.receipt_number}`}
        description="Transaction details and audit trail"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Details</CardTitle>
              <div className="flex gap-2">
                <StatusBadge status={txn.txn_type} />
                <StatusBadge
                  status={txn.is_voided ? "voided" : "active"}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Receipt Number</p>
                <p className="font-mono font-medium">{txn.receipt_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatINR(txn.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Mode</p>
                <p className="capitalize">
                  {txn.payment_mode.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p>
                  {new Date(txn.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">Narration</p>
              <p>{txn.narration}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Receipt Hash (SHA-256)
              </p>
              <p className="font-mono text-xs break-all text-muted-foreground">
                {txn.receipt_hash}
              </p>
            </div>

            {txn.is_voided && (
              <>
                <Separator />
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-2">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Voided
                  </p>
                  <p className="text-sm">{txn.void_reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {txn.voided_at &&
                      new Date(txn.voided_at).toLocaleString("en-IN")}
                  </p>
                </div>
              </>
            )}

            <div className="text-xs text-muted-foreground">
              Version: {txn.version}
            </div>
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Void Action */}
          {canVoid && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Void Transaction</CardTitle>
                <CardDescription>
                  This action is permanent and cannot be undone
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VoidTransactionForm
                  transactionId={transactionId}
                  currentUserId={user.id}
                />
              </CardContent>
            </Card>
          )}

          {/* Revision History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revision History</CardTitle>
              <CardDescription>
                {revisions.length} revision(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No revisions recorded.
                </p>
              ) : (
                <div className="space-y-3">
                  {revisions.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="rounded-lg border p-3 text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          #{rev.revision_number}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {rev.approval_status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Changed <strong>{rev.field_changed}</strong>:{" "}
                        {rev.old_value} → {rev.new_value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rev.change_reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
