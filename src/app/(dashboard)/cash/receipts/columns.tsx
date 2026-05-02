"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Eye, ExternalLink, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type ReceiptRow = {
  id: string;
  cashbook_id: string;
  cashbook_day_id: string;
  receipt_number: string;
  amount: number;
  party_name: string | null;
  payment_mode: string;
  narration: string;
  is_voided: boolean;
  created_at: string;
  /** Receipt date — the cashbook_day this transaction was posted into. */
  day?: { date: string } | null;
  creator?: { id: string; full_name: string | null; email: string | null } | null;
};

export const receiptColumns: ColumnDef<ReceiptRow>[] = [
  {
    accessorKey: "receipt_number",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Receipt #" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/cash/receipts/${row.original.id}`}
        className="font-mono text-sm text-primary hover:underline"
      >
        {row.getValue("receipt_number")}
      </Link>
    ),
  },
  {
    id: "receipt_date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Receipt Date" />
    ),
    cell: ({ row }) => {
      const dayDate = row.original.day?.date;
      return (
        <span className="text-sm font-medium">
          {dayDate
            ? new Date(dayDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.getValue("created_at")).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ),
  },
  {
    accessorKey: "party_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received From" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.getValue("party_name") || "—"}
      </span>
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold text-green-700 dark:text-green-400">
        {formatINR(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "payment_mode",
    header: "Mode",
    cell: ({ row }) => {
      const mode = row.getValue("payment_mode") as string;
      return (
        <span className="text-sm capitalize">
          {mode.replace(/_/g, " ")}
        </span>
      );
    },
  },
  {
    accessorKey: "narration",
    header: "Narration",
    cell: ({ row }) => {
      const narration = row.getValue("narration") as string;
      return (
        <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
          {narration}
        </span>
      );
    },
  },
  {
    id: "created_by",
    header: "Created By",
    cell: ({ row }) => {
      const c = row.original.creator;
      if (!c) return <span className="text-muted-foreground text-sm">—</span>;
      return (
        <div className="text-sm">
          <p className="font-medium">{c.full_name || c.email || "—"}</p>
          {c.full_name && c.email && (
            <p className="text-xs text-muted-foreground">{c.email}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "is_voided",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("is_voided") ? "voided" : "active"}
      />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const receipt = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/cash/receipts/${receipt.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View & Print
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/cash/cashbooks/${receipt.cashbook_id}/days`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Cashbook
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
