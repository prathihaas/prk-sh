"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";

export type FraudFlagRow = {
  id: string;
  flag_type: string;
  severity: string;
  description: string;
  table_name: string;
  record_id: string;
  company_id: string;
  branch_id: string | null;
  flagged_by: string | null;
  resolution_status: string;
  resolved_by: string | null;
  resolution_notes: string | null;
  flagged_at: string;
  resolved_at: string | null;
  flagged_by_user: { full_name: string } | null;
};

export const columns: ColumnDef<FraudFlagRow>[] = [
  {
    accessorKey: "flagged_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Flagged At" />
    ),
    cell: ({ row }) =>
      new Date(row.getValue("flagged_at")).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
  },
  {
    accessorKey: "flag_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("flag_type") as string;
      return (
        <span className="font-medium">
          {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      );
    },
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <StatusBadge status={row.getValue("severity")} />,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string;
      return (
        <span className="max-w-[250px] truncate block" title={desc}>
          {desc}
        </span>
      );
    },
  },
  {
    accessorKey: "resolution_status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.getValue("resolution_status")} />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const flag = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/audit/fraud-flags/${flag.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
