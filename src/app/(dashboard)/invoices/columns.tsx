"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Eye, Pencil, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type InvoiceRow = {
  id: string;
  dms_invoice_number: string | null;
  invoice_type: string;
  customer_name: string;
  invoice_date: string;
  grand_total: number;
  balance_due: number;
  approval_status: string;
};

export const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: "dms_invoice_number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice #" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("dms_invoice_number") || "—"}</span>
    ),
  },
  {
    accessorKey: "invoice_type",
    header: "Type",
    cell: ({ row }) => <StatusBadge status={row.getValue("invoice_type")} />,
  },
  {
    accessorKey: "customer_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
  },
  {
    accessorKey: "invoice_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => new Date(row.getValue("invoice_date")).toLocaleDateString("en-IN"),
  },
  {
    accessorKey: "grand_total",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
    cell: ({ row }) => <span className="tabular-nums">{formatINR(row.getValue("grand_total"))}</span>,
  },
  {
    accessorKey: "balance_due",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Balance Due" />,
    cell: ({ row }) => {
      const balance = row.getValue("balance_due") as number;
      return (
        <span className={`tabular-nums ${balance > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
          {formatINR(balance)}
        </span>
      );
    },
  },
  {
    accessorKey: "approval_status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("approval_status")} />,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoice.id}`}>
                <Eye className="mr-2 h-4 w-4" />View
              </Link>
            </DropdownMenuItem>
            {invoice.approval_status === "pending" && (
              <DropdownMenuItem asChild>
                <Link href={`/invoices/${invoice.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Link>
              </DropdownMenuItem>
            )}
            {invoice.balance_due > 0 && (
              <DropdownMenuItem asChild>
                <Link href={`/invoices/${invoice.id}/payments`}>
                  <CreditCard className="mr-2 h-4 w-4" />Record Payment
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
