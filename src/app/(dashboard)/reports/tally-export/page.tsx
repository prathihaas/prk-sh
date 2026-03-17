/**
 * Reports → Tally Export
 * ──────────────────────
 * UI for generating Tally Prime XML from daily / date-range transactions.
 *
 * Features:
 *  - Single date (daily) or date range selection
 *  - Live preview of voucher counts before download
 *  - One-click XML download
 *  - Export history table (last 20 batches)
 *  - Warnings surfaced inline
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  getTallySettings,
  getTallyExportHistory,
  getTxnsForExport,
  getTransfersForExport,
  type TallyExportBatch,
} from "@/lib/queries/tally-export";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Settings2, History, FileDown } from "lucide-react";
import { TallyExportForm } from "./tally-export-form";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default async function TallyExportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  const hasAccess =
    permissions.has(PERMISSIONS.REPORTING_BRANCH) ||
    permissions.has(PERMISSIONS.REPORTING_COMPANY) ||
    permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES);
  if (!hasAccess) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tally Export"
          description="Select a company from the header to start exporting."
        />
      </div>
    );
  }

  const params = await searchParams;
  const today = todayISO();
  const fromDate = params.from || today;
  const toDate = params.to || today;

  const [settings, history, txns, transfers] = await Promise.all([
    getTallySettings(companyId),
    getTallyExportHistory(companyId),
    getTxnsForExport(companyId, fromDate, toDate),
    getTransfersForExport(companyId, fromDate, toDate),
  ]);

  const isConfigured = !!settings.company_name;
  const receiptCount = txns.filter((t) => t.txn_type === "receipt").length;
  const paymentCount = txns.filter((t) => t.txn_type === "payment").length;
  const transferCount = transfers.length;
  const totalVouchers = receiptCount + paymentCount + transferCount;

  const unmappedCashbooks = new Set<string>();
  for (const txn of txns) {
    if (!settings.cashbook_ledger_map[txn.cashbook_id]) {
      unmappedCashbooks.add(txn.cashbook_name);
    }
  }
  for (const tr of transfers) {
    if (!settings.cashbook_ledger_map[tr.from_cashbook_id]) {
      unmappedCashbooks.add(tr.from_cashbook_name);
    }
    if (!settings.cashbook_ledger_map[tr.to_cashbook_id]) {
      unmappedCashbooks.add(tr.to_cashbook_name);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Tally Prime Export"
          description="Export daily transactions as Tally-compatible XML for direct import into Tally Prime."
        />
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href="/settings/tally">
            <Settings2 className="h-4 w-4" />
            Tally Settings
          </Link>
        </Button>
      </div>

      {/* ── Setup warning ─────────────────────────────────────── */}
      {!isConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">Tally settings not configured.</p>
            <p className="mt-1">
              Please{" "}
              <Link href="/settings/tally" className="underline font-medium">
                configure your Tally ledger mappings
              </Link>{" "}
              before exporting. The company name in Tally must be set.
            </p>
          </div>
        </div>
      )}

      {isConfigured && unmappedCashbooks.size > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">
              {unmappedCashbooks.size} cashbook(s) have no Tally ledger mapping — cashbook names will be used as fallback:
            </p>
            <p className="mt-1">{Array.from(unmappedCashbooks).join(", ")}</p>
            <p className="mt-1">
              <Link href="/settings/tally" className="underline">Fix in Tally Settings</Link> to ensure exact ledger names.
            </p>
          </div>
        </div>
      )}

      {isConfigured && unmappedCashbooks.size === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800 dark:text-green-300">
            <p className="font-semibold">
              All cashbooks are mapped. Exporting to: <span className="font-mono">{settings.company_name}</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Date picker + Download ────────────────────────── */}
        <div className="lg:col-span-1">
          <TallyExportForm
            fromDate={fromDate}
            toDate={toDate}
            isConfigured={isConfigured}
          />
        </div>

        {/* ── Preview counts ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileDown className="h-4 w-4" />
                Vouchers to export
              </CardTitle>
              <CardDescription>
                {fromDate === toDate
                  ? `Date: ${new Date(fromDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
                  : `${fromDate} to ${toDate}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalVouchers === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No transactions found for this date range.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Receipts", count: receiptCount, color: "text-green-600" },
                    { label: "Payments", count: paymentCount, color: "text-red-600" },
                    { label: "Contra (Transfers)", count: transferCount, color: "text-blue-600" },
                    { label: "Total Vouchers", count: totalVouchers, color: "" },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="rounded-lg border p-3 text-center">
                      <div className={`text-2xl font-bold tabular-nums ${color}`}>{count}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── What gets exported guide ─────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voucher type mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prk.sh Transaction</TableHead>
                      <TableHead>Tally Voucher Type</TableHead>
                      <TableHead>Accounting Entry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Payment Receipt (money in)</TableCell>
                      <TableCell><Badge variant="default">Receipt</Badge></TableCell>
                      <TableCell className="text-xs">Dr Cash/Bank · Cr Party / Sales</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Payment (money out)</TableCell>
                      <TableCell><Badge variant="destructive">Payment</Badge></TableCell>
                      <TableCell className="text-xs">Dr Party / Expense · Cr Cash/Bank</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cashbook Transfer</TableCell>
                      <TableCell><Badge variant="secondary">Contra</Badge></TableCell>
                      <TableCell className="text-xs">Dr Destination · Cr Source</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Export History ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Export History</CardTitle>
            <CardDescription>Last 20 Tally XML exports for this company</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No exports yet. Generate your first XML above.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Range</TableHead>
                    <TableHead className="text-right">Vouchers</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Exported By</TableHead>
                    <TableHead>Exported At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((batch: TallyExportBatch) => {
                    const exporter = batch.exporter;
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono text-xs">
                          {batch.from_date === batch.to_date
                            ? batch.from_date
                            : `${batch.from_date} → ${batch.to_date}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {batch.voucher_count}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {batch.filename || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {exporter?.full_name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(batch.exported_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
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
