"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Eye, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type TransactionRow = {
  id: string;
  cashbook_id: string;
  cashbook_day_id: string;
  receipt_number: string;
  txn_type: string;
  amount: number;
  payment_mode: string;
  narration: string;
  is_voided: boolean;
  created_at: string;
  source_type?: string | null;
};

function TxnTypeLabel({ txnType, sourceType }: { txnType: string; sourceType?: string | null }) {
  if (txnType === "receipt") {
    return (
      <Badge variant="outline" className="gap-1 border-green-300 text-green-700 bg-green-50">
        <ArrowDownLeft className="h-3 w-3" />
        Receipt
      </Badge>
    );
  }
  if (txnType === "payment" && sourceType === "expense") {
    return (
      <Badge variant="outline" className="gap-1 border-orange-300 text-orange-700 bg-orange-50">
        <ArrowUpRight className="h-3 w-3" />
        Expense
      </Badge>
    );
  }
  if (txnType === "payment") {
    return (
      <Badge variant="outline" className="gap-1 border-red-300 text-red-700 bg-red-50">
        <ArrowUpRight className="h-3 w-3" />
        Payment
      </Badge>
    );
  }
  return <StatusBadge status={txnType} />;
}

export const transactionColumns: ColumnDef<TransactionRow>[] = [
  {
    accessorKey: "receipt_number",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Receipt #" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("receipt_number")}</span>
    ),
  },
  {
    accessorKey: "txn_type",
    header: "Type",
    cell: ({ row }) => (
      <TxnTypeLabel
        txnType={row.getValue("txn_type")}
        sourceType={row.original.source_type}
      />
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const txnType = row.getValue("txn_type") as string;
      const isReceipt = txnType === "receipt";
      return (
        <span
          className={`tabular-nums font-medium ${
            isReceipt ? "text-green-600" : "text-red-600"
          }`}
        >
          {isReceipt ? "+" : "-"} {formatINR(row.getValue("amount"))}
        </span>
      );
    },
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
      const txn = row.original;
      return (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/cash/cashbooks/${txn.cashbook_id}/days/${txn.cashbook_day_id}/transactions/${txn.id}`}
          >
            <Eye className="mr-2 h-4 w-4" />
            View
          </Link>
        </Button>
      );
    },
  },
];
