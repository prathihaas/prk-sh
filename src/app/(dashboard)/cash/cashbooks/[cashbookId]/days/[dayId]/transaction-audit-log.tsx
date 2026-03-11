"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  changed_by: string;
  created_at: string;
  actor?: { full_name?: string; email?: string } | null;
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function AuditEntry({ log }: { log: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = ACTION_COLORS[log.action] || "";

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor}`}>
            {log.action}
          </span>
          <span className="text-sm font-medium">{log.actor?.full_name || "System"}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(log.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground" title={log.record_id}>
            {log.record_id.substring(0, 12)}...
          </span>
          {(log.old_data || log.new_data) && (
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Details
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          {log.old_data && (
            <div>
              <p className="font-semibold text-red-600 mb-1">Before:</p>
              <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(log.old_data, null, 2)}
              </pre>
            </div>
          )}
          {log.new_data && (
            <div>
              <p className="font-semibold text-green-600 mb-1">After:</p>
              <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(log.new_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionAuditLog({ logs }: { logs: Record<string, unknown>[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Transaction Audit Log</CardTitle>
          </div>
          <CardDescription>All changes to transactions on this day</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No audit log entries for this day.</p>
        </CardContent>
      </Card>
    );
  }

  const insertCount = logs.filter((l) => (l as AuditLogEntry).action === "INSERT").length;
  const updateCount = logs.filter((l) => (l as AuditLogEntry).action === "UPDATE").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Transaction Audit Log</CardTitle>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{insertCount} Created</Badge>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{updateCount} Modified</Badge>
          </div>
        </div>
        <CardDescription>Immutable audit trail of all transaction changes on this day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(logs as AuditLogEntry[]).map((log) => (
          <AuditEntry key={log.id} log={log} />
        ))}
      </CardContent>
    </Card>
  );
}
