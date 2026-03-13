"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { type getCashbookTransfers } from "@/lib/queries/cashbook-transfers";

export type TransferRow = Awaited<ReturnType<typeof getCashbookTransfers>>[number];

export const columns: ColumnDef<TransferRow>[] = [
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
