"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { deleteApprovalMatrixEntry } from "@/lib/queries/approval-matrix";

export type ApprovalMatrixRow = {
  id: string;
  step_order: number;
  entity_type: string;
  approver_role_id: string;
  is_active: boolean;
  approver_role: { id: string; name: string } | null;
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  expense: "Expense",
  invoice: "Invoice",
  variance_approval: "Cashbook Variance",
  receipt: "Receipt",
  void_transaction: "Void Transaction",
  cashbook_reopen: "Cashbook Reopen",
  payment_mode_change: "Payment Mode Change",
  high_value_txn: "High Value Transaction",
  refund: "Refund",
  payroll_reopen: "Payroll Reopen",
  attendance_close: "Attendance Close",
};

export const columns: ColumnDef<ApprovalMatrixRow>[] = [
  {
    accessorKey: "step_order",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Step Order" />
    ),
  },
  {
    accessorKey: "entity_type",
    header: "Request Type",
    cell: ({ row }) =>
      REQUEST_TYPE_LABELS[row.getValue("entity_type") as string] ||
      row.getValue("entity_type"),
  },
  {
    id: "approver_role_name",
    header: "Approver Role",
    cell: ({ row }) => row.original.approver_role?.name || "\u2014",
  },
  {
    accessorKey: "is_active",
    header: "Active",
    cell: ({ row }) => (
      <StatusBadge status={row.getValue("is_active") ? "active" : "inactive"} />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const entry = row.original;

      async function handleDelete() {
        const result = await deleteApprovalMatrixEntry(entry.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Approval step deleted");
        }
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/settings/approval-matrix/${entry.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <ConfirmDialog
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              }
              title="Delete Approval Step"
              description="Are you sure you want to delete this approval step? This action cannot be undone."
              onConfirm={handleDelete}
              confirmLabel="Delete"
              variant="destructive"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
