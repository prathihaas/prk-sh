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

type ApprovalStepRow = {
  id: string;
  status: string;
};

export type ApprovalRequestRow = {
  id: string;
  request_type: string;
  reference_id: string;
  overall_status: string;
  current_step: number;
  created_at: string;
  steps: ApprovalStepRow[];
};

const TYPE_LABELS: Record<string, string> = {
  expense: "Expense",
  invoice: "Invoice",
  cashbook_variance: "Cashbook Variance",
};

export const columns: ColumnDef<ApprovalRequestRow>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created Date" />
    ),
    cell: ({ row }) =>
      new Date(row.getValue("created_at")).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
  },
  {
    accessorKey: "request_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("request_type") as string;
      return (
        <span className="font-medium">
          {TYPE_LABELS[type] || type}
        </span>
      );
    },
  },
  {
    accessorKey: "reference_id",
    header: "Reference ID",
    cell: ({ row }) => {
      const refId = row.getValue("reference_id") as string;
      return (
        <span className="font-mono text-sm">
          {refId.slice(0, 8)}...
        </span>
      );
    },
  },
  {
    accessorKey: "overall_status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.getValue("overall_status")} />
    ),
  },
  {
    id: "steps_progress",
    header: "Steps Progress",
    cell: ({ row }) => {
      const steps = row.original.steps || [];
      const completed = steps.filter(
        (s) => s.status === "approved" || s.status === "rejected" || s.status === "skipped"
      ).length;
      const total = steps.length;
      return (
        <span className="text-sm text-muted-foreground tabular-nums">
          {completed}/{total}
        </span>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const request = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/approvals/${request.id}`}>
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
