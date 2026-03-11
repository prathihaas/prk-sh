"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type CashbookDayRow = {
  id: string;
  cashbook_id: string;
  date: string;
  opening_balance: number;
  system_closing: number | null;
  physical_count: number | null;
  variance: number | null;
  status: string;
};

export const columns: ColumnDef<CashbookDayRow>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {new Date(row.getValue("date")).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    accessorKey: "opening_balance",
    header: "Opening",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatINR(row.getValue("opening_balance"))}
      </span>
    ),
  },
  {
    accessorKey: "system_closing",
    header: "System Closing",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.getValue("system_closing") !== null
          ? formatINR(row.getValue("system_closing"))
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "physical_count",
    header: "Physical Count",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.getValue("physical_count") !== null
          ? formatINR(row.getValue("physical_count"))
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "variance",
    header: "Variance",
    cell: ({ row }) => {
      const variance = row.getValue("variance") as number | null;
      if (variance === null) return <span>—</span>;
      return (
        <span
          className={`tabular-nums font-medium ${
            variance === 0
              ? "text-green-600"
              : variance > 0
                ? "text-blue-600"
                : "text-red-600"
          }`}
        >
          {formatINR(variance)}
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
    cell: ({ row }) => {
      const day = row.original;
      return (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/cash/cashbooks/${day.cashbook_id}/days/${day.id}`}
          >
            <Eye className="mr-2 h-4 w-4" />
            View
          </Link>
        </Button>
      );
    },
  },
];
