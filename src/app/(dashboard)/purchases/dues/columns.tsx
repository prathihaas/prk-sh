"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/components/shared/currency-display";
import { PURCHASE_TYPE_LABELS } from "@/lib/validators/purchase";

export type PurchaseDueRow = {
  id: string;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  due_date: string | null;
  purchase_type: string;
  supplier: { name: string; phone?: string | null } | null;
  grand_total: number;
  total_paid: number;
  balance_due: number;
};

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export const dueColumns: ColumnDef<PurchaseDueRow>[] = [
  {
    id: "supplier",
    header: "Supplier",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.supplier?.name ?? "—"}</p>
        {row.original.supplier?.phone && (
          <p className="text-xs text-muted-foreground">{row.original.supplier.phone}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "supplier_invoice_number",
    header: "Invoice #",
  },
  {
    accessorKey: "purchase_type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">
        {PURCHASE_TYPE_LABELS[row.original.purchase_type] ?? row.original.purchase_type}
      </Badge>
    ),
  },
  {
    accessorKey: "due_date",
    header: "Due Date",
    cell: ({ row }) => {
      if (!row.original.due_date) return <span className="text-muted-foreground">—</span>;
      const overdue = daysOverdue(row.original.due_date);
      return (
        <div>
          <p>{new Date(row.original.due_date).toLocaleDateString("en-IN")}</p>
          {overdue !== null && overdue > 0 && (
            <p className="text-xs text-red-600 font-medium">{overdue} days overdue</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "grand_total",
    header: "Invoice Total",
    cell: ({ row }) => formatINR(row.original.grand_total),
  },
  {
    accessorKey: "balance_due",
    header: "Balance Due",
    cell: ({ row }) => (
      <span className="text-red-600 font-semibold">
        {formatINR(row.original.balance_due)}
      </span>
    ),
  },
];
