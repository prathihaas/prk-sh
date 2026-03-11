import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getUnapprovedPayments } from "@/lib/queries/expenses";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportButton } from "@/components/shared/export-button";
import { type ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXPORT_COLUMNS = [
  { key: "payment_date", header: "Payment Date", width: 16, format: "date" as const },
  { key: "expense_date", header: "Expense Date", width: 16, format: "date" as const },
  { key: "category_name", header: "Category", width: 22 },
  { key: "amount", header: "Amount (INR)", width: 16, format: "currency" as const },
  { key: "description", header: "Description", width: 40 },
  { key: "bill_reference", header: "Bill Ref", width: 18 },
  { key: "submitted_by_name", header: "Submitted By", width: 22 },
  { key: "paid_by_name", header: "Paid By", width: 22 },
  { key: "cashbook_name", header: "Cashbook", width: 22 },
  { key: "approval_status", header: "Status at Payment", width: 20 },
  { key: "payment_mode", header: "Payment Mode", width: 16 },
];

type UnapprovedPaymentRow = {
  id: string;
  expense_date: string;
  payment_date: string | null;
  amount: number;
  description: string;
  approval_status: string;
  payment_mode: string | null;
  category: { name: string } | null;
  cashbook?: { id: string; name: string } | null;
  submitter?: { id: string; full_name: string | null; email: string | null } | null;
  payer?: { id: string; full_name: string | null; email: string | null } | null;
};

const columns: ColumnDef<UnapprovedPaymentRow>[] = [
  {
    accessorKey: "payment_date",
    header: "Payment Date",
    cell: ({ row }) => {
      const d = row.getValue("payment_date") as string | null;
      return d ? new Date(d).toLocaleDateString("en-IN") : "—";
    },
  },
  {
    accessorKey: "expense_date",
    header: "Expense Date",
    cell: ({ row }) =>
      new Date(row.getValue("expense_date")).toLocaleDateString("en-IN"),
  },
  {
    id: "category_name",
    header: "Category",
    cell: ({ row }) => row.original.category?.name || "—",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold text-red-600">
        {formatINR(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="max-w-[180px] truncate block">
        {row.getValue("description")}
      </span>
    ),
  },
  {
    id: "submitted_by",
    header: "Submitted By",
    cell: ({ row }) => {
      const s = row.original.submitter;
      if (!s) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-sm">
          <p className="font-medium">{s.full_name || s.email || "—"}</p>
          {s.full_name && s.email && (
            <p className="text-xs text-muted-foreground">{s.email}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "paid_by",
    header: "Paid By",
    cell: ({ row }) => {
      const p = row.original.payer;
      if (!p) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-sm">
          <p className="font-medium text-orange-700 dark:text-orange-400">
            {p.full_name || p.email || "—"}
          </p>
          {p.full_name && p.email && (
            <p className="text-xs text-muted-foreground">{p.email}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "cashbook",
    header: "Cashbook",
    cell: ({ row }) => {
      const cb = row.original.cashbook;
      return cb ? (
        <span className="text-sm font-medium">{cb.name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    },
  },
  {
    accessorKey: "approval_status",
    header: "Stage at Payment",
    cell: ({ row }) => <StatusBadge status={row.getValue("approval_status")} />,
  },
  {
    accessorKey: "payment_mode",
    header: "Mode",
    cell: ({ row }) => {
      const mode = row.getValue("payment_mode") as string | null;
      return mode ? <StatusBadge status={mode} /> : "—";
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/expenses/${row.original.id}`}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Link>
      </Button>
    ),
  },
];

export default async function UnapprovedPaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Unapproved Payments Report"
          description="Select a company from the header"
        />
      </div>
    );
  }

  const payments = await getUnapprovedPayments(companyId, branchId);
  const totalAmount = payments.reduce((sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0);

  // Flatten for export
  const exportData = (payments as Array<{
    category?: { name?: string } | null;
    cashbook?: { name?: string } | null;
    submitter?: { full_name?: string | null; email?: string | null } | null;
    payer?: { full_name?: string | null; email?: string | null } | null;
    [key: string]: unknown;
  }>).map((p) => ({
    ...p,
    category_name: p.category?.name || "",
    cashbook_name: p.cashbook?.name || "",
    submitted_by_name: p.submitter?.full_name || p.submitter?.email || "",
    paid_by_name: p.payer?.full_name || p.payer?.email || "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Unapproved Payments Report"
          description="Expenses paid by cashiers directly without completing the full approval workflow"
        />
        <div className="flex-shrink-0 pt-1">
          <ExportButton
            data={exportData as Record<string, unknown>[]}
            columns={EXPORT_COLUMNS}
            filename={`unapproved_payments_${new Date().toISOString().split("T")[0]}`}
            label="Export"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <div>
          <p className="font-semibold text-red-800 dark:text-red-200">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} made without full approval
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            Total Amount: <strong>{formatINR(totalAmount)}</strong> — These payments were processed by cashiers before completing the approval workflow. Click &quot;View&quot; on any row to see the voucher and take action.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={payments}
        emptyMessage="No unapproved payments found — all payments followed the approval workflow"
      />
    </div>
  );
}
