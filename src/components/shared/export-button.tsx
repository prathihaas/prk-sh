"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { ExcelColumn } from "@/lib/utils/excel-export";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns?: ExcelColumn[];
  filename?: string;
  fileName?: string;
  exportFn?: (data: Record<string, unknown>[]) => Promise<void>;
  label?: string;
  size?: "sm" | "default";
}

export function ExportButton({
  data,
  columns,
  filename,
  fileName,
  exportFn,
  label = "Export",
  size = "sm",
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const resolvedFilename = filename ?? fileName ?? "export";

  async function handleExcel() {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    setIsExporting(true);
    try {
      if (exportFn) {
        await exportFn(data);
      } else if (columns) {
        const { exportToExcel } = await import("@/lib/utils/excel-export");
        await exportToExcel(data, columns, resolvedFilename);
      }
      toast.success(`Exported ${data.length} rows to Excel`);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  function handleCsv() {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    if (!columns) return;
    const headers = columns.map((c) => c.header);
    const rows = data.map((row) =>
      columns.map((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") ? `"${str}"` : str;
      })
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resolvedFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} rows to CSV`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={isExporting} className="gap-2">
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExcel}>
          Export as Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCsv}>
          Export as CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
