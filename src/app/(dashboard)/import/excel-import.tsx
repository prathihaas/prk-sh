"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createReceipt } from "@/lib/queries/receipts";
import { createExpense } from "@/lib/queries/expenses";
import { createTransactionForImport } from "@/lib/queries/cashbook-transactions";

interface ExcelImportProps {
  companyId: string;
  branchId: string;
  financialYearId: string;
  currentUserId: string;
  cashbooks: { id: string; name: string; type: string }[];
  expenseCategories: { id: string; name: string }[];
}

type ImportModule = "receipts" | "expenses" | "cashbook_transactions";
type ImportRow = Record<string, string>;
type ImportResult = { row: number; status: "success" | "error"; message: string; data?: ImportRow };

const MODULE_LABELS: Record<ImportModule, string> = {
  receipts: "Receipts",
  expenses: "Expenses",
  cashbook_transactions: "Cashbook Transactions",
};

const TEMPLATES: Record<ImportModule, { headers: string[]; example: string[] }> = {
  receipts: {
    headers: ["date", "party_name", "amount", "payment_mode", "narration", "cashbook_id"],
    example: ["2025-04-01", "Shri Rajesh Kumar", "25000", "cash", "Vehicle booking advance", "CASHBOOK_ID_HERE"],
  },
  expenses: {
    headers: ["expense_date", "category_id", "amount", "description", "bill_reference", "notes"],
    example: ["2025-04-01", "CATEGORY_ID_HERE", "5000", "Office supplies", "BILL-001", "Monthly stationery"],
  },
  cashbook_transactions: {
    headers: ["date", "txn_type", "amount", "payment_mode", "narration", "party_name", "cashbook_id"],
    example: ["2025-04-01", "payment", "15000", "bank_transfer", "Vendor payment", "ABC Suppliers", "CASHBOOK_ID_HERE"],
  },
};

function downloadTemplate(module: ImportModule) {
  const template = TEMPLATES[module];
  const csvContent = [
    template.headers.join(","),
    template.example.join(","),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${module}_import_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: ImportRow = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export function ExcelImport({
  companyId,
  branchId,
  financialYearId,
  currentUserId,
  cashbooks,
  expenseCategories,
}: ExcelImportProps) {
  const [selectedModule, setSelectedModule] = useState<ImportModule>("receipts");
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setParsedRows(rows);
      toast.info(`Parsed ${rows.length} rows from ${file.name}`);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (parsedRows.length === 0) {
      toast.error("No data to import. Please upload a CSV file first.");
      return;
    }
    setIsImporting(true);
    setResults([]);
    const importResults: ImportResult[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        let result: { error?: string; success?: boolean } = {};

        if (selectedModule === "receipts") {
          if (!row.cashbook_id || !row.date || !row.amount || !row.payment_mode) {
            importResults.push({ row: i + 2, status: "error", message: "Missing required fields: cashbook_id, date, amount, payment_mode", data: row });
            continue;
          }
          result = await createReceipt({
            cashbook_id: row.cashbook_id,
            date: row.date,
            amount: parseFloat(row.amount),
            payment_mode: row.payment_mode as "cash" | "cheque" | "upi" | "bank_transfer" | "card" | "finance",
            narration: row.narration || "",
            party_name: row.party_name || "",
            company_id: companyId,
            branch_id: branchId,
            created_by: currentUserId,
            financial_year_id: financialYearId,
            allow_backdate: true, // Allow backdate during bulk import
          });
        } else if (selectedModule === "expenses") {
          if (!row.category_id || !row.expense_date || !row.amount || !row.description) {
            importResults.push({ row: i + 2, status: "error", message: "Missing required fields: category_id, expense_date, amount, description", data: row });
            continue;
          }
          result = await createExpense({
            category_id: row.category_id,
            expense_date: row.expense_date,
            amount: parseFloat(row.amount),
            description: row.description,
            bill_reference: row.bill_reference || undefined,
            notes: row.notes || undefined,
            company_id: companyId,
            branch_id: branchId,
            submitted_by: currentUserId,
            financial_year_id: financialYearId,
          });
        } else if (selectedModule === "cashbook_transactions") {
          if (!row.cashbook_id || !row.date || !row.amount || !row.txn_type) {
            importResults.push({ row: i + 2, status: "error", message: "Missing required fields: cashbook_id, date, amount, txn_type", data: row });
            continue;
          }
          result = await createTransactionForImport({
            cashbook_id: row.cashbook_id,
            date: row.date,
            txn_type: row.txn_type as "receipt" | "payment",
            amount: parseFloat(row.amount),
            payment_mode: (row.payment_mode as "cash" | "cheque" | "upi" | "bank_transfer" | "card" | "finance") || "cash",
            narration: row.narration || "",
            party_name: row.party_name || "",
            company_id: companyId,
            branch_id: branchId,
            created_by: currentUserId,
            financial_year_id: financialYearId,
          });
        }

        if (result.error) {
          importResults.push({ row: i + 2, status: "error", message: result.error, data: row });
        } else {
          importResults.push({ row: i + 2, status: "success", message: "Imported successfully", data: row });
        }
      } catch (err) {
        importResults.push({ row: i + 2, status: "error", message: String(err), data: row });
      }
    }

    setResults(importResults);
    setIsImporting(false);

    const successCount = importResults.filter((r) => r.status === "success").length;
    const errorCount = importResults.filter((r) => r.status === "error").length;

    if (successCount > 0) {
      toast.success(`Import complete: ${successCount} records imported successfully.`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} rows failed to import. Check the results below.`);
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Module selector + Template download */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-lg">1. Choose Module & Download Template</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Import Into</label>
            <Select value={selectedModule} onValueChange={(v) => {
              setSelectedModule(v as ImportModule);
              setParsedRows([]);
              setResults([]);
              setFileName(null);
            }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODULE_LABELS) as ImportModule[]).map((mod) => (
                  <SelectItem key={mod} value={mod}>{MODULE_LABELS[mod]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => downloadTemplate(selectedModule)} className="gap-2">
            <Download className="h-4 w-4" />
            Download Template CSV
          </Button>
        </div>

        {/* Show reference data for IDs */}
        {selectedModule === "receipts" || selectedModule === "cashbook_transactions" ? (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Available Cashbook IDs:</p>
            <div className="space-y-1">
              {cashbooks.map((cb) => (
                <div key={cb.id} className="flex items-center gap-2 text-xs font-mono bg-muted rounded px-2 py-1">
                  <span className="text-muted-foreground">{cb.name} ({cb.type}):</span>
                  <span className="select-all">{cb.id}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedModule === "expenses" && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Available Category IDs:</p>
            <div className="space-y-1">
              {expenseCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 text-xs font-mono bg-muted rounded px-2 py-1">
                  <span className="text-muted-foreground">{cat.name}:</span>
                  <span className="select-all">{cat.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File upload */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-lg">2. Upload CSV File</h3>
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">
            {fileName ? fileName : "Click to upload CSV file"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports .csv format. Use the template above for correct column headers.
          </p>
          {parsedRows.length > 0 && (
            <p className="mt-2 text-sm text-green-600 font-medium">
              {parsedRows.length} rows ready to import
            </p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {parsedRows.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                  {Object.keys(parsedRows[0]).map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2 text-muted-foreground">{i + 2}</td>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-2 max-w-[150px] truncate">{val}</td>
                    ))}
                  </tr>
                ))}
                {parsedRows.length > 5 && (
                  <tr>
                    <td colSpan={99} className="px-3 py-2 text-center text-muted-foreground">
                      ... and {parsedRows.length - 5} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import action */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-lg">3. Import Data</h3>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 flex gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Imports are permanent and create real records. All imported data will appear in the audit log. Double-check your CSV before importing.</p>
        </div>

        <Button
          onClick={handleImport}
          disabled={isImporting || parsedRows.length === 0}
          className="gap-2"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing... ({results.length}/{parsedRows.length})
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import {parsedRows.length > 0 ? `${parsedRows.length} Records` : ""}
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Import Results</h3>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> {successCount} succeeded
              </span>
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <XCircle className="h-4 w-4" /> {errorCount} failed
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((result, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-md px-3 py-2 text-sm ${
                  result.status === "success"
                    ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                    : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
                }`}
              >
                {result.status === "success" ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-medium">Row {result.row}:</span> {result.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
