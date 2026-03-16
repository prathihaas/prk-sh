"use client";

// Excel export utility using SheetJS (xlsx)
// Usage: exportToExcel(data, columns, filename)

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  format?: "currency" | "date" | "text" | "number";
}

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExcelColumn[],
  filename: string
): Promise<void> {
  const XLSX = await import("xlsx");

  // Build header row
  const headers = columns.map((c) => c.header);

  // Build data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return "";
      if (col.format === "currency") {
        return typeof val === "number" ? val : parseFloat(String(val));
      }
      if (col.format === "date" && val) {
        return new Date(String(val)).toLocaleDateString("en-IN");
      }
      if (col.format === "number") {
        return typeof val === "number" ? val : parseFloat(String(val));
      }
      return String(val);
    })
  );

  // Create workbook
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = columns.map((col) => ({ wch: col.width || 20 }));

  // Style header row (bold)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: "1a1a2e" } } };
  }

  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Convenience wrappers for each module
export function exportTransactions(transactions: Record<string, unknown>[]) {
  // Pre-format datetime and flatten nested objects if present
  const rows = transactions.map((t) => {
    const creator = t.creator as { full_name?: string } | null;
    const contra = t.contra_cashbook as { name?: string } | null;
    const voider = t.voider as { full_name?: string } | null;
    const createdAt = t.created_at
      ? new Date(String(t.created_at)).toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "";
    return {
      ...t,
      created_at_fmt: createdAt,
      is_voided: t.is_voided ? "Yes" : "No",
      created_by_name: creator?.full_name || (t.created_by_name as string) || "",
      contra_cashbook_name: contra?.name || (t.contra_cashbook_name as string) || "",
      voided_by_name: voider?.full_name || (t.voided_by_name as string) || "",
    };
  });

  return exportToExcel(
    rows,
    [
      { key: "receipt_number", header: "Receipt No", width: 18 },
      { key: "created_at_fmt", header: "Date & Time", width: 24 },
      { key: "txn_type", header: "Type", width: 12 },
      { key: "amount", header: "Amount (INR)", width: 16, format: "currency" },
      { key: "payment_mode", header: "Payment Mode", width: 16 },
      { key: "party_name", header: "Party Name", width: 28 },
      { key: "narration", header: "Narration", width: 40 },
      { key: "created_by_name", header: "Created By", width: 22 },
      { key: "contra_cashbook_name", header: "Contra Cashbook", width: 22 },
      { key: "is_voided", header: "Voided?", width: 10 },
      { key: "void_reason", header: "Void Reason", width: 35 },
      { key: "voided_by_name", header: "Voided By", width: 22 },
    ],
    `transactions_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportReceipts(receipts: Record<string, unknown>[]) {
  return exportToExcel(
    receipts,
    [
      { key: "receipt_number", header: "Receipt No", width: 18 },
      { key: "created_at", header: "Date", width: 20, format: "date" },
      { key: "txn_type", header: "Type", width: 12 },
      { key: "amount", header: "Amount (INR)", width: 16, format: "currency" },
      { key: "payment_mode", header: "Payment Mode", width: 16 },
      { key: "party_name", header: "Party Name", width: 25 },
      { key: "narration", header: "Narration", width: 40 },
      { key: "is_voided", header: "Status", width: 10 },
    ],
    `receipts_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportExpenses(expenses: Record<string, unknown>[]) {
  return exportToExcel(
    expenses,
    [
      { key: "expense_date", header: "Expense Date", width: 16, format: "date" },
      { key: "category_name", header: "Category", width: 20 },
      { key: "amount", header: "Amount (INR)", width: 16, format: "currency" },
      { key: "description", header: "Description", width: 40 },
      { key: "bill_reference", header: "Bill Ref", width: 18 },
      { key: "approval_status", header: "Status", width: 18 },
      { key: "payment_date", header: "Payment Date", width: 16, format: "date" },
      { key: "payment_mode", header: "Payment Mode", width: 16 },
    ],
    `expenses_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportAuditLog(logs: Record<string, unknown>[]) {
  return exportToExcel(
    logs,
    [
      { key: "created_at", header: "Timestamp", width: 22, format: "date" },
      { key: "table_name", header: "Table", width: 25 },
      { key: "action", header: "Action", width: 10 },
      { key: "record_id", header: "Record ID", width: 38 },
      { key: "actor_name", header: "Changed By", width: 25 },
      { key: "ip_address", header: "IP Address", width: 18 },
    ],
    `audit_log_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportInvoices(invoices: Record<string, unknown>[]) {
  return exportToExcel(
    invoices,
    [
      { key: "dms_invoice_number", header: "Invoice No", width: 18 },
      { key: "invoice_date", header: "Date", width: 16, format: "date" },
      { key: "invoice_type", header: "Type", width: 18 },
      { key: "customer_name", header: "Customer", width: 30 },
      { key: "customer_phone", header: "Phone", width: 16 },
      { key: "customer_gstin", header: "GSTIN", width: 18 },
      { key: "grand_total", header: "Grand Total (INR)", width: 18, format: "currency" },
      { key: "total_received", header: "Amount Received (INR)", width: 20, format: "currency" },
      { key: "balance_due", header: "Balance Due (INR)", width: 18, format: "currency" },
      { key: "approval_status", header: "Approval Status", width: 20 },
      { key: "is_settled", header: "Settled?", width: 12 },
      { key: "notes", header: "Notes", width: 40 },
    ],
    `invoices_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportPurchases(purchases: Record<string, unknown>[]) {
  return exportToExcel(
    purchases,
    [
      { key: "supplier_invoice_number", header: "Supplier Invoice No", width: 22 },
      { key: "invoice_date", header: "Date", width: 16, format: "date" },
      { key: "due_date", header: "Due Date", width: 16, format: "date" },
      { key: "purchase_type", header: "Purchase Type", width: 18 },
      { key: "supplier_name", header: "Supplier", width: 30 },
      { key: "grand_total", header: "Grand Total (INR)", width: 18, format: "currency" },
      { key: "total_paid", header: "Amount Paid (INR)", width: 18, format: "currency" },
      { key: "balance_due", header: "Balance Due (INR)", width: 18, format: "currency" },
      { key: "notes", header: "Notes", width: 40 },
    ],
    `purchases_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportSuppliers(suppliers: Record<string, unknown>[]) {
  return exportToExcel(
    suppliers,
    [
      { key: "name", header: "Supplier Name", width: 30 },
      { key: "gstin", header: "GSTIN", width: 18 },
      { key: "pan", header: "PAN", width: 14 },
      { key: "phone", header: "Phone", width: 16 },
      { key: "email", header: "Email", width: 30 },
      { key: "is_active", header: "Active?", width: 10 },
    ],
    `suppliers_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportTransfers(transfers: Record<string, unknown>[]) {
  return exportToExcel(
    transfers,
    [
      { key: "transfer_date", header: "Date", width: 16, format: "date" },
      { key: "transfer_type", header: "Type", width: 16 },
      { key: "from_branch_name", header: "From Branch", width: 25 },
      { key: "to_branch_name", header: "To Branch", width: 25 },
      { key: "status", header: "Status", width: 14 },
      { key: "total_value", header: "Value (INR)", width: 16, format: "currency" },
      { key: "notes", header: "Notes", width: 40 },
    ],
    `transfers_${new Date().toISOString().split("T")[0]}`
  );
}

export function exportUnapprovedPayments(payments: Record<string, unknown>[]) {
  return exportToExcel(
    payments,
    [
      { key: "payment_date", header: "Payment Date", width: 16, format: "date" },
      { key: "expense_date", header: "Expense Date", width: 16, format: "date" },
      { key: "category_name", header: "Category", width: 20 },
      { key: "amount", header: "Amount (INR)", width: 16, format: "currency" },
      { key: "description", header: "Description", width: 40 },
      { key: "approval_status", header: "Approval Stage", width: 20 },
      { key: "payment_mode", header: "Payment Mode", width: 16 },
      { key: "bill_reference", header: "Bill Ref", width: 18 },
    ],
    `unapproved_payments_${new Date().toISOString().split("T")[0]}`
  );
}
