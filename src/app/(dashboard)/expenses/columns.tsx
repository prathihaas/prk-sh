"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Eye, Pencil, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type ExpenseRow = {
  id: string;
  expense_date: string;
  amount: number;
  description: string;
  approval_status: string;
  category: { name: string } | null;
  payment_date?: string | null;
  payment_mode?: string | null;
  submitter?: { full_name: string | null; email: string | null } | null;
  payer?: { full_name: string | null; email: string | null } | null;
};

export const columns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: "expense_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Expense Date" />,
    cell: ({ row }) => new Date(row.getValue("expense_date")).toLocaleDateString("en-IN"),
  },
  {
    id: "category_name",
    header: "Category",
    cell: ({ row }) => row.original.category?.name || "\u2014",
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <span className="tabular-nums">{formatINR(row.getValue("amount"))}</span>,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string;
      return <span className="max-w-[200px] truncate block">{desc}</span>;
    },
  },
  {
    id: "created_by",
    header: "Submitted By",
    cell: ({ row }) => {
      const s = row.original.submitter;
      if (!s) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-sm">
          <p className="font-medium">{s.full_name || s.email || "—"}</p>
          {s.full_name && s.email && (
            <p className="text-xs text-muted-foreground">{s.email}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "approval_status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("approval_status")} />,
  },
  {
    id: "paid_by",
    header: "Paid By",
    cell: ({ row }) => {
      const p = row.original.payer;
      if (!p) return <span className="text-muted-foreground text-sm">—</span>;
      return (
        <div className="text-sm">
          <p className="font-medium">{p.full_name || p.email || "—"}</p>
          {p.full_name && p.email && (
            <p className="text-xs text-muted-foreground">{p.email}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "payment_date",
    header: "Payment",
    cell: ({ row }) => {
      const paymentDate = row.original.payment_date;
      if (paymentDate) {
        return (
          <div className="text-sm">
            <span className="text-green-600 font-medium">Paid</span>
            <br />
            <span className="text-xs text-muted-foreground">
              {new Date(paymentDate).toLocaleDateString("en-IN")}
            </span>
          </div>
        );
      }
      if (row.original.approval_status === "owner_approved") {
        return (
          <span className="text-sm text-orange-600 font-medium">Pending</span>
        );
      }
      return <span className="text-sm text-muted-foreground">\u2014</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const expense = row.original;
      const canPay =
        !expense.payment_date && (expense.approval_status === "owner_approved" || expense.approval_status === "submitted" || expense.approval_status === "draft" || expense.approval_status === "branch_approved" || expense.approval_status === "accounts_approved");

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/expenses/${expense.id}`}><Eye className="mr-2 h-4 w-4" />View</Link>
            </DropdownMenuItem>
            {(expense.approval_status === "draft" || expense.approval_status === "submitted") && (
              <DropdownMenuItem asChild>
                <Link href={`/expenses/${expense.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link>
              </DropdownMenuItem>
            )}
            {canPay && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/expenses/${expense.id}/pay`}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay via Cashbook
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
