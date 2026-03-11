"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";

const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export type AttendancePeriodRow = { id: string; month: number; year: number; status: string; };

export const columns: ColumnDef<AttendancePeriodRow>[] = [
  { id: "period", header: "Period", cell: ({ row }) => <span className="font-medium">{MONTH_NAMES[row.original.month]} {row.original.year}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status")} /> },
  { id: "actions", cell: ({ row }) => (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/hr/attendance/${row.original.id}`}><Eye className="mr-2 h-4 w-4" />View Grid</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>) },
];
