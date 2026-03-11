"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Pencil, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatINR } from "@/components/shared/currency-display";

export type EmployeeRow = { id: string; employee_code: string; full_name: string; designation: string | null; department: string | null; status: string; joining_date: string; basic_salary: number; };

export const columns: ColumnDef<EmployeeRow>[] = [
  { accessorKey: "employee_code", header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />, cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("employee_code")}</span> },
  { accessorKey: "full_name", header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />, cell: ({ row }) => <div className="font-medium">{row.getValue("full_name")}</div> },
  { accessorKey: "designation", header: "Designation", cell: ({ row }) => row.getValue("designation") || "—" },
  { accessorKey: "department", header: "Department", cell: ({ row }) => row.getValue("department") || "—" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status")} /> },
  { accessorKey: "joining_date", header: ({ column }) => <DataTableColumnHeader column={column} title="Joining Date" />, cell: ({ row }) => new Date(row.getValue("joining_date")).toLocaleDateString("en-IN") },
  { accessorKey: "basic_salary", header: ({ column }) => <DataTableColumnHeader column={column} title="Basic Salary" />, cell: ({ row }) => <span className="tabular-nums">{formatINR(row.getValue("basic_salary"))}</span> },
  { id: "actions", cell: ({ row }) => { const emp = row.original; return (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/hr/employees/${emp.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/hr/employees/${emp.id}/leave`}><Calendar className="mr-2 h-4 w-4" />Leave</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>); } },
];
