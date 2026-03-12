"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";

export type UnapprovedPaymentRow = {
  id: string;
  expense_date: string;
  payment_date: string | null;
  amount: number;
  description: string;
  approval_status: string;
  payment_mode: string | null;
  category: { name: string } | null;
  cashbook?: { id: string; name: string } | null;
  submitter?: { id: string; full_name: string | null; email: string | null } | null;
  payer?: { id: string; full_name: string | null; email: string | null } | null;
};

export const columns: ColumnDef<UnapprovedPaymentRow>[] = [
  {
    accessorKey: "payment_date",
    header: "Payment Date",
    cell: ({ row }) => {
      const d = row.getValue("payment_date") as string | null;
      return d ? new Date(d).toLocaleDateString("en-IN") : "—";
    },
  },
  {
    accessorKey: "expense_date",
    header: "Expense Date",
    cell: ({ row }) =>
      new Date(row.getValue("expense_date")).toLocaleDateString("en-IN"),
  },
  {
    id: "category_name",
    header: "Category",
    cell: ({ row }) => row.original.category?.name || "—",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold text-red-600">
        {formatINR(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="max-w-[180px] truncate block">
        {row.getValue("description")}
      </span>
    ),
  },
  {
    id: "submitted_by",
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
    id: "paid_by",
    header: "Paid By",
    cell: ({ row }) => {
      const p = row.original.payer;
      if (!p) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-sm">
          <p className="font-medium text-orange-700 dark:text-orange-400">
            {p.full_name || p.email || "—"}
          </p>
          {p.full_name && p.email && (
            <p className="text-xs text-muted-foreground">{p.email}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "cashbook",
    header: "Cashbook",
    cell: ({ row }) => {
      const cb = row.original.cashbook;
      return cb ? (
        <span className="text-sm font-medium">{cb.name}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    },
  },
  {
    accessorKey: "approval_status",
    header: "Stage at Payment",
    cell: ({ row }) => <StatusBadge status={row.getValue("approval_status")} />,
  },
  {
    accessorKey: "payment_mode",
    header: "Mode",
    cell: ({ row }) => {
      const mode = row.getValue("payment_mode") as string | null;
      return mode ? <StatusBadge status={mode} /> : "—";
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/expenses/${row.original.id}`}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Link>
      </Button>
    ),
  },
];
