"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";

export type CompanyRow = {
  id: string;
  name: string;
  code: string;
  legal_name: string | null;
  gstin: string | null;
  is_active: boolean;
  created_at: string;
};

export const columns: ColumnDef<CompanyRow>[] = [
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
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
    cell: ({ row }) => (
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
        {row.getValue("code")}
      </code>
    ),
  },
  {
    accessorKey: "legal_name",
    header: "Legal Name",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("legal_name") || "—"}
      </span>
    ),
  },
  {
    accessorKey: "gstin",
    header: "GSTIN",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">
        {row.getValue("gstin") || "—"}
      </span>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.getValue("is_active") ? "active" : "inactive"} />
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const company = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/org/companies/${company.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
