"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Eye, Pencil, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";

export type CustomerRow = {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  customer_type: string;
  gstin: string | null;
  is_active: boolean;
  created_at: string;
};

export const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "customer_code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer ID" />
    ),
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-primary">
        {row.getValue("customer_code")}
      </span>
    ),
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.getValue("full_name")}</p>
        {row.original.email && (
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) =>
      row.getValue("phone") || (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => {
      const city = row.original.city;
      const state = row.original.state;
      if (!city && !state) return <span className="text-muted-foreground">—</span>;
      return <span>{[city, state].filter(Boolean).join(", ")}</span>;
    },
  },
  {
    accessorKey: "customer_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("customer_type") as string;
      return (
        <Badge variant="outline" className="capitalize">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "gstin",
    header: "GSTIN",
    cell: ({ row }) =>
      row.getValue("gstin") || (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) =>
      row.getValue("is_active") ? (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const customer = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/sales/customers/${customer.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/sales/customers/${customer.id}/edit`}>
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
