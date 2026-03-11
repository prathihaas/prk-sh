"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { toggleCustomField } from "@/lib/queries/custom-fields";

type CustomFieldRow = {
  id: string;
  field_name: string;
  table_name: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
};

const TABLE_LABELS: Record<string, string> = {
  employees: "Employees",
  expenses: "Expenses",
  invoices: "Invoices",
  cashbook_transactions: "Cashbook Transactions",
};

const columns: ColumnDef<CustomFieldRow>[] = [
  {
    accessorKey: "field_name",
    header: "Field Name",
  },
  {
    accessorKey: "table_name",
    header: "Table",
    cell: ({ row }) =>
      TABLE_LABELS[row.getValue("table_name") as string] ||
      row.getValue("table_name"),
  },
  {
    accessorKey: "field_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("field_type") as string;
      return type.charAt(0).toUpperCase() + type.slice(1);
    },
  },
  {
    accessorKey: "is_required",
    header: "Required",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("is_required") ? "required" : "optional"}
      />
    ),
  },
  {
    accessorKey: "is_active",
    header: "Active",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("is_active") ? "active" : "inactive"}
      />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const field = row.original;

      async function handleToggle() {
        const result = await toggleCustomField(field.id, !field.is_active);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            field.is_active ? "Field deactivated" : "Field activated"
          );
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
            <DropdownMenuItem onClick={handleToggle}>
              {field.is_active ? (
                <>
                  <ToggleLeft className="mr-2 h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <ToggleRight className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface CustomFieldsColumnsProps {
  data: CustomFieldRow[];
}

export function CustomFieldsColumns({ data }: CustomFieldsColumnsProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="No custom fields defined"
    />
  );
}
