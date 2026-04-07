"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, CalendarDays, LockOpen, Lock } from "lucide-react";
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

export type BankAccountRow = {
  id: string;
  name: string;
  type: string;
  opening_balance: number;
  current_balance?: number;
  is_active: boolean;
};

function AccountActions({ account }: { account: BankAccountRow }) {
  const router = useRouter();

  async function handleToggle() {
    const result = account.is_active
      ? await closeCashbookAccount(account.id)
      : await openCashbookAccount(account.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(account.is_active ? "Account closed" : "Account opened");
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
          <Link href={`/cash/cashbooks/${account.id}/days`}>
            <CalendarDays className="mr-2 h-4 w-4" />
            View Transactions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleToggle}>
          {account.is_active ? (
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

export const columns: ColumnDef<BankAccountRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bank Account Name" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
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
    cell: ({ row }) => <AccountActions account={row.original} />,
  },
];
