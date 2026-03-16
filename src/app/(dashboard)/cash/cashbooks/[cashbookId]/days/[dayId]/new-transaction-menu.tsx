"use client";

import Link from "next/link";
import { Plus, ChevronDown, ArrowDownToLine, ShoppingCart, Receipt, Banknote, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NewTransactionMenuProps {
  cashbookId: string;
  dayId: string;
  canTransfer: boolean;
}

export function NewTransactionMenu({
  cashbookId,
  dayId,
  canTransfer,
}: NewTransactionMenuProps) {
  const base = `/cash/cashbooks/${cashbookId}/days/${dayId}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* ── Money In ─────────────────────────────────────────────── */}
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Money In
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/cash/receipts/new" className="flex items-center gap-2 cursor-pointer">
              <ArrowDownToLine className="h-4 w-4 text-green-600" />
              <div className="flex flex-col">
                <span>Payment Receipt</span>
                <span className="text-xs text-muted-foreground">Numbered receipt</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/sales/sales-receipts/new" className="flex items-center gap-2 cursor-pointer">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <div className="flex flex-col">
                <span>Sales Receipt</span>
                <span className="text-xs text-muted-foreground">Vehicle / Service sale</span>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* ── Money Out ────────────────────────────────────────────── */}
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Money Out
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`${base}/pay-expense`} className="flex items-center gap-2 cursor-pointer">
              <Receipt className="h-4 w-4 text-red-600" />
              <div className="flex flex-col">
                <span>Expense Payment</span>
                <span className="text-xs text-muted-foreground">Pay an approved expense</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${base}/transactions/new`} className="flex items-center gap-2 cursor-pointer">
              <Banknote className="h-4 w-4 text-red-600" />
              <div className="flex flex-col">
                <span>Other Payment</span>
                <span className="text-xs text-muted-foreground">Generic outflow</span>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {canTransfer && (
          <>
            <DropdownMenuSeparator />

            {/* ── Internal ─────────────────────────────────────────── */}
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Internal
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/cash/cashbook-transfers/new" className="flex items-center gap-2 cursor-pointer">
                  <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                  <div className="flex flex-col">
                    <span>Transfer</span>
                    <span className="text-xs text-muted-foreground">Between cashbooks</span>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
