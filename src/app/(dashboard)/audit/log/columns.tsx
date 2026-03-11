"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";

export type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string;
  company_id: string;
  branch_id: string | null;
  ip_address: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};

const ACTION_VARIANTS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function ActionBadge({ action }: { action: string }) {
  const variant = ACTION_VARIANTS[action] || "";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variant}`}
    >
      {action}
    </span>
  );
}

function ExpandableJsonCell({ row }: { row: AuditLogRow }) {
  const [expanded, setExpanded] = useState(false);

  if (!row.old_data && !row.new_data) {
    return <span className="text-muted-foreground">&mdash;</span>;
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          {row.old_data && (
            <div>
              <span className="font-semibold text-red-600">Old:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2">
                {JSON.stringify(row.old_data, null, 2)}
              </pre>
            </div>
          )}
          {row.new_data && (
            <div>
              <span className="font-semibold text-green-600">New:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2">
                {JSON.stringify(row.new_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const columns: ColumnDef<AuditLogRow>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) =>
      new Date(row.getValue("created_at")).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
  },
  {
    accessorKey: "table_name",
    header: "Table",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.getValue("table_name")}
      </span>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => <ActionBadge action={row.getValue("action")} />,
  },
  {
    accessorKey: "record_id",
    header: "Record ID",
    cell: ({ row }) => {
      const id = row.getValue("record_id") as string;
      return (
        <span className="font-mono text-xs" title={id}>
          {id.substring(0, 8)}...
        </span>
      );
    },
  },
  {
    id: "changed_by_name",
    header: "Changed By",
    cell: ({ row }) => row.original.actor?.full_name || "\u2014",
  },
  {
    id: "details",
    header: "Details",
    cell: ({ row }) => <ExpandableJsonCell row={row.original} />,
  },
];
