import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbookTransfers } from "@/lib/queries/cashbook-transfers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowRightLeft, Eye, Plus } from "lucide-react";

type TransferRow = Awaited<ReturnType<typeof getCashbookTransfers>>[number];

const columns: ColumnDef<TransferRow>[] = [
  {
    accessorKey: "transfer_date",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.getValue("transfer_date")).toLocaleDateString("en-IN"),
  },
  {
    id: "from_cashbook",
    header: "From",
    cell: ({ row }) => {
      const cb = row.original.from_cashbook as { name: string; type: string } | null;
      if (!cb) return "—";
      return (
        <span className="text-sm">
          <span className="font-medium">{cb.name}</span>
          <span className="ml-1 text-xs text-muted-foreground capitalize">({cb.type})</span>
        </span>
      );
    },
  },
  {
    id: "to_cashbook",
    header: "To",
    cell: ({ row }) => {
      const cb = row.original.to_cashbook as { name: string; type: string } | null;
      if (!cb) return "—";
      return (
        <span className="text-sm">
          <span className="font-medium">{cb.name}</span>
          <span className="ml-1 text-xs text-muted-foreground capitalize">({cb.type})</span>
        </span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold">
        {formatINR(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block text-sm">
        {row.getValue("description")}
      </span>
    ),
  },
  {
    id: "created_by",
    header: "Requested By",
    cell: ({ row }) => {
      const creator = row.original.creator as { full_name?: string | null; email?: string | null } | null;
      return (
        <span className="text-sm text-muted-foreground">
          {creator?.full_name || creator?.email || "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/cash/cashbook-transfers/${row.original.id}`}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Link>
      </Button>
    ),
  },
];

export default async function CashbookTransfersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cashbook Transfers"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  let transfers: TransferRow[] = [];
  try {
    transfers = await getCashbookTransfers(companyId, branchId);
  } catch (err) {
    console.error("Failed to load cashbook transfers:", err);
  }

  const canCreate = permissions.has(PERMISSIONS.CASHBOOK_TRANSFER_CREATE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Cashbook Transfers"
          description="Internal money transfers between cashbooks — requires accountant approval before funds move"
        />
        {canCreate && (
          <Button asChild className="flex-shrink-0">
            <Link href="/cash/cashbook-transfers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Transfer
            </Link>
          </Button>
        )}
      </div>

      {/* Summary counts */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["pending", "approved", "rejected"] as const).map((s) => {
          const count = transfers.filter((t) => t.status === s).length;
          const total = transfers
            .filter((t) => t.status === s)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          return (
            <div
              key={s}
              className="rounded-lg border bg-card p-4 flex items-center gap-3"
            >
              <ArrowRightLeft className={`h-5 w-5 flex-shrink-0 ${
                s === "pending" ? "text-amber-500" :
                s === "approved" ? "text-green-500" : "text-red-500"
              }`} />
              <div>
                <p className="text-xs text-muted-foreground capitalize">{s}</p>
                <p className="font-semibold tabular-nums">{formatINR(total)}</p>
                <p className="text-xs text-muted-foreground">{count} transfer{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={transfers}
        emptyMessage="No cashbook transfers found"
      />
    </div>
  );
}
