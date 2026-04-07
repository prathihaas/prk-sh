"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Pencil, CalendarDays, LockOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";
import { openCashbookAccount, closeCashbookAccount } from "@/lib/queries/cashbooks";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type CashbookRow = {
  id: string;
  name: string;
  type: string;
  opening_balance: number;
  current_balance?: number;
  is_active: boolean;
};

function CashbookActions({ cashbook }: { cashbook: CashbookRow }) {
  const router = useRouter();

  async function handleToggle() {
    const result = cashbook.is_active
      ? await closeCashbookAccount(cashbook.id)
      : await openCashbookAccount(cashbook.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(cashbook.is_active ? "Account closed" : "Account opened");
      router.refresh();
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
          <Link href={`/cash/cashbooks/${cashbook.id}/days`}>
            <CalendarDays className="mr-2 h-4 w-4" />
            View Days
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/cash/cashbooks/${cashbook.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleToggle}>
          {cashbook.is_active ? (
            <>
              <Lock className="mr-2 h-4 w-4 text-red-500" />
              <span className="text-red-600">Close Account</span>
            </>
          ) : (
            <>
              <LockOpen className="mr-2 h-4 w-4 text-green-500" />
              <span className="text-green-600">Open Account</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const columns: ColumnDef<CashbookRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <StatusBadge status={row.getValue("type")} />,
  },
  {
    accessorKey: "current_balance",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Current Balance" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold">
        {formatINR(row.original.current_balance ?? row.original.opening_balance)}
      </span>
    ),
  },
  {
    accessorKey: "opening_balance",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Opening Balance" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatINR(row.getValue("opening_balance"))}
      </span>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Account Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("is_active") ? "open" : "closed"}
      />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <CashbookActions cashbook={row.original} />,
  },
];
