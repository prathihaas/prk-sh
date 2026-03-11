"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/components/shared/currency-display";
import { PURCHASE_TYPE_LABELS } from "@/lib/validators/purchase";

export type PurchaseInvoiceRow = {
  id: string;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  purchase_type: string;
  supplier: { name: string } | null;
  grand_total: number;
  total_paid: number;
  balance_due: number;
  due_date: string | null;
};

export const columns: ColumnDef<PurchaseInvoiceRow>[] = [
  {
    accessorKey: "supplier_invoice_number",
    header: "Supplier Invoice #",
  },
  {
    accessorKey: "supplier_invoice_date",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.supplier_invoice_date).toLocaleDateString("en-IN"),
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
    id: "supplier",
    header: "Supplier",
    cell: ({ row }) => row.original.supplier?.name ?? "—",
  },
  {
    accessorKey: "grand_total",
    header: "Grand Total",
    cell: ({ row }) => formatINR(row.original.grand_total),
  },
  {
    accessorKey: "total_paid",
    header: "Paid",
    cell: ({ row }) => formatINR(row.original.total_paid),
  },
  {
    accessorKey: "balance_due",
    header: "Balance Due",
    cell: ({ row }) => {
      const due = row.original.balance_due;
      return (
        <span className={due > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
          {formatINR(due)}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const due = row.original.balance_due;
      return (
        <Badge variant={due > 0 ? "destructive" : "default"}>
          {due > 0 ? "Due" : "Paid"}
        </Badge>
      );
    },
  },
];
