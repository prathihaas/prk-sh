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
  field_label: string;
  entity_type: string;
  field_type: string;
  is_mandatory: boolean;
  is_active: boolean;
  display_order: number;
};

const ENTITY_LABELS: Record<string, string> = {
  cashbook: "Cashbook",
  receipt: "Receipt",
  payment: "Payment",
  invoice: "Invoice",
  expense: "Expense",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  dropdown: "Dropdown",
  date: "Date",
  boolean: "Boolean",
};

const columns: ColumnDef<CustomFieldRow>[] = [
  {
    accessorKey: "field_label",
    header: "Display Label",
  },
  {
    accessorKey: "field_name",
    header: "Key",
    cell: ({ row }) => (
      <code className="text-xs bg-muted px-1 py-0.5 rounded">
        {row.getValue("field_name")}
      </code>
    ),
  },
  {
    accessorKey: "entity_type",
    header: "Entity",
    cell: ({ row }) =>
      ENTITY_LABELS[row.getValue("entity_type") as string] ||
      row.getValue("entity_type"),
  },
  {
    accessorKey: "field_type",
    header: "Type",
    cell: ({ row }) =>
      FIELD_TYPE_LABELS[row.getValue("field_type") as string] ||
      row.getValue("field_type"),
  },
  {
    accessorKey: "is_mandatory",
    header: "Mandatory",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("is_mandatory") ? "required" : "optional"}
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
