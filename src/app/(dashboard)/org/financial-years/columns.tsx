"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { toggleFinancialYearLock } from "@/lib/queries/financial-years";

export type FYRow = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  is_active: boolean;
  locked_by_user: { full_name: string } | null;
  locked_at: string | null;
};

export const columns: ColumnDef<FYRow>[] = [
  {
    accessorKey: "label",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Label" />,
    cell: ({ row }) => <div className="font-medium">{row.getValue("label")}</div>,
  },
  {
    accessorKey: "start_date",
    header: "Start Date",
    cell: ({ row }) => format(new Date(row.getValue("start_date")), "dd MMM yyyy"),
  },
  {
    accessorKey: "end_date",
    header: "End Date",
    cell: ({ row }) => format(new Date(row.getValue("end_date")), "dd MMM yyyy"),
  },
  {
    accessorKey: "is_locked",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("is_locked") ? "locked" : "active"} />,
  },
  {
    accessorKey: "locked_by_user",
    header: "Locked By",
    cell: ({ row }) => {
      const user = row.original.locked_by_user;
      return <span className="text-muted-foreground">{user?.full_name || "—"}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const fy = row.original;
      const isLocked = fy.is_locked;

      async function handleToggle() {
        const result = await toggleFinancialYearLock(fy.id, !isLocked);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(isLocked ? "Financial year unlocked" : "Financial year locked");
        }
      }

      return (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {isLocked ? "Unlock" : "Lock"}
            </Button>
          }
          title={isLocked ? "Unlock Financial Year?" : "Lock Financial Year?"}
          description={
            isLocked
              ? `Unlocking "${fy.label}" will allow modifications to records in this period.`
              : `Locking "${fy.label}" will prevent any modifications to financial records in this period. This action is audited.`
          }
          onConfirm={handleToggle}
          confirmLabel={isLocked ? "Unlock" : "Lock"}
          variant={isLocked ? "default" : "destructive"}
        />
      );
    },
  },
];
