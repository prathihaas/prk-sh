"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export type SupplierRow = {
  id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export const supplierColumns: ColumnDef<SupplierRow>[] = [
  {
    accessorKey: "name",
    header: "Supplier Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "gstin",
    header: "GSTIN",
    cell: ({ row }) => row.original.gstin ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "pan",
    header: "PAN",
    cell: ({ row }) => row.original.pan ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];
