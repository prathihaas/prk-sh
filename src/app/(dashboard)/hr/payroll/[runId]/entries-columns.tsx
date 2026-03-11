"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type PayrollEntryRow = {
  id: string;
  employee: { employee_code: string; full_name: string } | null;
  days_worked: number;
  total_working_days: number;
  gross_earnings: number;
  pf_deduction: number;
  esi_deduction: number;
  pt_deduction: number;
  net_salary: number;
};

export const entriesColumns: ColumnDef<PayrollEntryRow>[] = [
  {
    id: "employee",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Employee" />
    ),
    cell: ({ row }) => (
      <div>
        <span className="font-mono text-xs text-muted-foreground mr-2">
          {row.original.employee?.employee_code}
        </span>
        <span className="font-medium">
          {row.original.employee?.full_name}
        </span>
      </div>
    ),
  },
  {
    id: "days",
    header: "Days",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.days_worked}/{row.original.total_working_days}
      </span>
    ),
  },
  {
    accessorKey: "gross_earnings",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gross" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatINR(row.getValue("gross_earnings"))}
      </span>
    ),
  },
  {
    accessorKey: "pf_deduction",
    header: "PF",
    cell: ({ row }) => (
      <span className="tabular-nums text-red-600">
        {formatINR(row.getValue("pf_deduction"))}
      </span>
    ),
  },
  {
    accessorKey: "esi_deduction",
    header: "ESI",
    cell: ({ row }) => (
      <span className="tabular-nums text-red-600">
        {formatINR(row.getValue("esi_deduction"))}
      </span>
    ),
  },
  {
    accessorKey: "pt_deduction",
    header: "PT",
    cell: ({ row }) => (
      <span className="tabular-nums text-red-600">
        {formatINR(row.getValue("pt_deduction"))}
      </span>
    ),
  },
  {
    accessorKey: "net_salary",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Net Salary" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-medium text-green-600">
        {formatINR(row.getValue("net_salary"))}
      </span>
    ),
  },
];
