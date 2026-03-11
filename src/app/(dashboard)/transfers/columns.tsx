"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/currency-display";
import { TRANSFER_TYPE_LABELS } from "@/lib/validators/transfer";
import { Eye } from "lucide-react";

export type TransferRow = {
  id: string;
  transfer_date: string;
  transfer_type: string;
  status: string;
  total_value: number;
  from_company: { name: string } | null;
  from_branch: { name: string } | null;
  to_company: { name: string } | null;
  to_branch: { name: string } | null;
  challans: { challan_number: string }[];
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  dispatched: "outline",
  in_transit: "default",
  received: "default",
  cancelled: "destructive",
};

export const columns: ColumnDef<TransferRow>[] = [
  {
    accessorKey: "transfer_date",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.transfer_date).toLocaleDateString("en-IN"),
  },
  {
    id: "challan",
    header: "Challan #",
    cell: ({ row }) =>
      row.original.challans?.[0]?.challan_number ?? (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    accessorKey: "transfer_type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">
        {TRANSFER_TYPE_LABELS[row.original.transfer_type] ?? row.original.transfer_type}
      </Badge>
    ),
  },
  {
    id: "from",
    header: "From",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.from_company?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{row.original.from_branch?.name}</p>
      </div>
    ),
  },
  {
    id: "to",
    header: "To",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.to_company?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{row.original.to_branch?.name}</p>
      </div>
    ),
  },
  {
    accessorKey: "total_value",
    header: "Value",
    cell: ({ row }) => formatINR(row.original.total_value),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANTS[row.original.status] ?? "outline"}>
        {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="icon">
        <Link href={`/transfers/${row.original.id}`}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
    ),
  },
];
