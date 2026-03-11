import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getReceiptWithContext } from "@/lib/queries/receipts";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { PrintReceipt } from "@/components/shared/print-receipt";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft } from "lucide-react";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  let data;
  try {
    data = await getReceiptWithContext(receiptId);
  } catch {
    notFound();
  }

  const { transaction, cashbook, company, branch } = data;

  // Only show receipt-type transactions on this page
  if (transaction.txn_type !== "receipt") {
    notFound();
  }

  const dateFormatted = new Date(transaction.created_at).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cash/receipts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Receipts
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Receipt ${transaction.receipt_number}`}
        description="View and print receipt in Indian accounting format"
      />

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main: Printable Receipt */}
        <div className="lg:col-span-3">
          <PrintReceipt
            transaction={transaction}
            company={company}
            branch={branch}
            cashbook={cashbook}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Cashbook Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cashbook</CardTitle>
              <CardDescription>Source cashbook for this receipt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">
                {cashbook?.name || "Unknown Cashbook"}
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link
                  href={`/cash/cashbooks/${transaction.cashbook_id}/days`}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Cashbook
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Transaction Meta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge
                  status={transaction.is_voided ? "voided" : "active"}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{dateFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <StatusBadge status={transaction.txn_type} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="capitalize">
                  {transaction.payment_mode.replace(/_/g, " ")}
                </span>
              </div>
              {transaction.is_voided && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                    Voided
                  </p>
                  {transaction.void_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {transaction.void_reason}
                    </p>
                  )}
                  {transaction.voided_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.voided_at).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verification */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Verification</CardTitle>
              <CardDescription>SHA-256 receipt hash</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs break-all text-muted-foreground">
                {transaction.receipt_hash}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
