import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbook } from "@/lib/queries/cashbooks";
import { getCashbookDay } from "@/lib/queries/cashbook-days";
import { getTransactions } from "@/lib/queries/cashbook-transactions";
import { getAuditLogs } from "@/lib/queries/audit-log";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { formatINR } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { transactionColumns } from "./transactions/columns";
import { DayActions } from "./day-actions";
import { ExportButton } from "@/components/shared/export-button";
import { TransactionAuditLog } from "./transaction-audit-log";

export default async function CashbookDayDetailPage({
  params,
}: {
  params: Promise<{ cashbookId: string; dayId: string }>;
}) {
  const { cashbookId, dayId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  let cashbook, day;
  try {
    [cashbook, day] = await Promise.all([getCashbook(cashbookId), getCashbookDay(dayId)]);
  } catch {
    notFound();
  }

  const transactions = await getTransactions(dayId);
  const isOpen = day.status === "open" || day.status === "reopened";
  const canCreateTxn = isOpen && permissions.has(PERMISSIONS.CASHBOOK_CREATE_TXN);
  const canClose = isOpen && permissions.has(PERMISSIONS.CASHBOOK_CLOSE_DAY);
  const canReopen = day.status === "closed" && permissions.has(PERMISSIONS.CASHBOOK_REOPEN_DAY);

  const { cookies } = await import("next/headers");
  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const auditLogs = companyId
    ? await getAuditLogs(companyId, { table_name: "cashbook_transactions", from_date: day.date, to_date: day.date })
    : [];

  const dateFormatted = new Date(day.date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const exportData = transactions.map((t: Record<string, unknown>) => {
    const creator = t.creator as { full_name?: string } | null;
    const contra = t.contra_cashbook as { name?: string } | null;
    const voider = t.voider as { full_name?: string } | null;
    const createdAt = t.created_at ? new Date(String(t.created_at)).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    return {
      ...t,
      created_at_fmt: createdAt,
      is_voided: t.is_voided ? "Yes" : "No",
      created_by_name: creator?.full_name || "",
      contra_cashbook_name: contra?.name || "",
      voided_by_name: voider?.full_name || "",
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={`${cashbook.name} — ${dateFormatted}`} description="Daily cashbook record with transactions" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Status</CardDescription></CardHeader>
          <CardContent><StatusBadge status={day.status} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Opening Balance</CardDescription></CardHeader>
          <CardContent><p className="text-lg font-semibold tabular-nums">{formatINR(day.opening_balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>System Closing</CardDescription></CardHeader>
          <CardContent><p className="text-lg font-semibold tabular-nums">{day.system_closing !== null ? formatINR(day.system_closing) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Physical Count</CardDescription></CardHeader>
          <CardContent><p className="text-lg font-semibold tabular-nums">{day.physical_count !== null ? formatINR(day.physical_count) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Variance</CardDescription></CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold tabular-nums ${day.variance === null ? "" : day.variance === 0 ? "text-green-600" : Number(day.variance) > 0 ? "text-blue-600" : "text-red-600"}`}>
              {day.variance !== null ? formatINR(day.variance) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <DayActions dayId={dayId} dayStatus={day.status} systemClosing={day.system_closing} currentUserId={user.id} canClose={canClose} canReopen={canReopen} />

      <Tabs defaultValue="transactions">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
            <TabsTrigger value="audit">Audit Log ({auditLogs.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <ExportButton
              data={exportData as Record<string, unknown>[]}
              columns={[
                { key: "receipt_number", header: "Receipt No", width: 18 },
                { key: "created_at_fmt", header: "Date & Time", width: 24 },
                { key: "txn_type", header: "Type", width: 12 },
                { key: "amount", header: "Amount (INR)", width: 16, format: "currency" },
                { key: "payment_mode", header: "Payment Mode", width: 16 },
                { key: "party_name", header: "Party Name", width: 28 },
                { key: "narration", header: "Narration", width: 40 },
                { key: "created_by_name", header: "Created By", width: 22 },
                { key: "contra_cashbook_name", header: "Contra Cashbook", width: 22 },
                { key: "is_voided", header: "Voided?", width: 10 },
                { key: "void_reason", header: "Void Reason", width: 35 },
                { key: "voided_by_name", header: "Voided By", width: 22 },
              ]}
              filename={`cashbook_${cashbook.name}_${day.date}`}
              label="Export"
            />
            {canCreateTxn && (
              <Button asChild size="sm">
                <Link href={`/cash/cashbooks/${cashbookId}/days/${dayId}/transactions/new`}>
                  <Plus className="mr-2 h-4 w-4" />New Transaction
                </Link>
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>{transactions.length} transaction(s) for {dateFormatted}</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={transactionColumns} data={transactions} emptyMessage="No transactions yet" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <TransactionAuditLog logs={auditLogs as Record<string, unknown>[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
