import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbookTransfer } from "@/lib/queries/cashbook-transfers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { TransferApprovalActions } from "./approval-actions";

export default async function CashbookTransferDetailPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const { transferId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  let transfer;
  try {
    transfer = await getCashbookTransfer(transferId);
  } catch {
    notFound();
  }

  const canApprove =
    permissions.has(PERMISSIONS.CASHBOOK_TRANSFER_APPROVE) &&
    transfer.status === "pending";

  const from = transfer.from_cashbook as { name: string; type: string } | null;
  const to = transfer.to_cashbook as { name: string; type: string } | null;
  const creator = transfer.creator as { full_name?: string | null; email?: string | null } | null;
  const approver = transfer.approver as { full_name?: string | null; email?: string | null } | null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/cash/cashbook-transfers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>
      </Button>

      <PageHeader
        title="Cashbook Transfer"
        description={`Internal money transfer request — ${transfer.status}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Details</CardTitle>
              <CardDescription>
                {new Date(transfer.transfer_date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Route */}
              <div className="flex items-center justify-center gap-4 rounded-lg border bg-muted/30 px-6 py-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">From (Debit)</p>
                  <p className="font-semibold">{from?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{from?.type}</p>
                </div>
                <ArrowRightLeft className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">To (Credit)</p>
                  <p className="font-semibold">{to?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{to?.type}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                  {formatINR(transfer.amount)}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason / Description</p>
                <p className="text-sm">{transfer.description}</p>
              </div>

              {/* Rejection reason */}
              {transfer.status === "rejected" && transfer.reject_reason && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {transfer.reject_reason}
                  </p>
                </div>
              )}

              {/* Approved transactions */}
              {transfer.status === "approved" && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                    Transfer Completed
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Cashbook transactions have been created and balances updated.
                  </p>
                  <div className="mt-2 space-y-1">
                    {transfer.from_txn_id && (
                      <p className="text-xs text-green-600 font-mono">
                        Debit TXN: {transfer.from_txn_id.substring(0, 12)}...
                      </p>
                    )}
                    {transfer.to_txn_id && (
                      <p className="text-xs text-green-600 font-mono">
                        Credit TXN: {transfer.to_txn_id.substring(0, 12)}...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval actions */}
          {canApprove && (
            <TransferApprovalActions
              transferId={transferId}
              approvedBy={user.id}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={transfer.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Transfer Date</span>
                <span>{new Date(transfer.transfer_date).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(transfer.created_at).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requested By</span>
                <span className="text-right">
                  {creator?.full_name || creator?.email || "—"}
                </span>
              </div>
              {approver && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {transfer.status === "approved" ? "Approved By" : "Reviewed By"}
                  </span>
                  <span className="text-right">
                    {approver.full_name || approver.email || "—"}
                  </span>
                </div>
              )}
              {transfer.approved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Action Date</span>
                  <span>{new Date(transfer.approved_at).toLocaleDateString("en-IN")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {transfer.status === "pending" && !canApprove && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium mb-1">Awaiting Approval</p>
              <p className="text-xs">
                An accountant with approval rights must approve this transfer before funds move.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
