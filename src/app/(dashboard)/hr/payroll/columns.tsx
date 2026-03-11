"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Eye } from "lucide-react";
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

const MN = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type PayrollRunRow = {
  id: string;
  month: number;
  year: number;
  status: string;
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
};

export const columns: ColumnDef<PayrollRunRow>[] = [
  {
    id: "period",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Period" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {MN[row.original.month]} {row.original.year}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "total_gross",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gross" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.total_gross
          ? formatINR(row.original.total_gross)
          : "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "total_deductions",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Deductions" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.total_deductions
          ? formatINR(row.original.total_deductions)
          : "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "total_net",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Net Pay" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">
        {row.original.total_net
          ? formatINR(row.original.total_net)
          : "\u2014"}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/hr/payroll/${row.original.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
