"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/currency-display";
import { amountToIndianWords } from "@/lib/utils/number-to-words";

interface PrintExpenseVoucherProps {
  expense: {
    id: string;
    expense_date: string;
    amount: number;
    description: string;
    bill_reference?: string | null;
    notes?: string | null;
    approval_status: string;
    payment_date?: string | null;
    payment_mode?: string | null;
    paid_by?: string | null;
    category?: { name: string } | null;
    submitter?: { full_name?: string | null; email?: string | null } | null;
    cashbook?: { name: string } | null;
  };
  voucher_number?: string;
  company: {
    name: string;
    gst_number?: string | null;
    address?: string | null;
    pan_number?: string | null;
    logo_url?: string | null;
  } | null;
  branch: {
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
}

export function PrintExpenseVoucher({
  expense,
  voucher_number,
  company,
  branch,
}: PrintExpenseVoucherProps) {
  const expDateFormatted = new Date(expense.expense_date).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "short", year: "numeric" }
  );
  const payDateFormatted = expense.payment_date
    ? new Date(expense.payment_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const amountInWords = amountToIndianWords(expense.amount);
  const paymentMode = expense.payment_mode
    ? expense.payment_mode
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";

  const voucherNo = voucher_number || expense.id.substring(0, 8).toUpperCase();

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    branch_approved: "Branch Approved",
    accounts_approved: "Accounts Approved",
    owner_approved: "Owner Approved",
    paid: "Paid",
    paid_direct: "Paid (Direct — Without Full Approval)",
    rejected: "Rejected",
  };

  const stageOrder = [
    "submitted",
    "branch_approved",
    "accounts_approved",
    "owner_approved",
  ];
  const effectiveStatus =
    expense.approval_status === "paid" || expense.approval_status === "paid_direct"
      ? "owner_approved"
      : expense.approval_status;
  const currentStageIndex = stageOrder.indexOf(effectiveStatus);

  const printStyles = `
    @media print {
      body * { visibility: hidden !important; }
      #print-voucher-area, #print-voucher-area * { visibility: visible !important; }
      #print-voucher-area {
        position: absolute; left: 0; top: 0; width: 100%;
        background: white !important; color: black !important;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      @page { size: A4 portrait; margin: 12mm; }
      .no-print { display: none !important; }
      .print-border { border-color: #000 !important; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Print Button */}
      <div className="no-print flex items-center gap-3 mb-4">
        <Button onClick={() => window.print()} size="lg">
          <Printer className="mr-2 h-5 w-5" />
          Print Voucher
        </Button>
        <span className="text-sm text-muted-foreground">
          Prints in A4 format — Indian Income Tax payment voucher format
        </span>
      </div>

      {/* Voucher */}
      <div
        id="print-voucher-area"
        className="mx-auto max-w-[720px] border-2 border-gray-800 dark:border-gray-200 bg-white dark:bg-white text-black rounded-sm print-border"
      >
        {/* Header */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-4 text-center">
          {company?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-12 object-contain mx-auto mb-2"
            />
          )}
          <h1 className="text-xl font-bold tracking-widest mb-1">PAYMENT VOUCHER</h1>
          {company && <h2 className="text-lg font-semibold">{company.name}</h2>}
          {branch && (
            <p className="text-sm">
              {branch.name}
              {branch.address ? ` \u2022 ${branch.address}` : ""}
            </p>
          )}
          {branch?.phone && (
            <p className="text-xs text-gray-600">Tel: {branch.phone}</p>
          )}
          <div className="flex justify-center gap-6 mt-1 text-xs text-gray-600">
            {company?.gst_number && <span>GSTIN: {company.gst_number}</span>}
            {company?.pan_number && <span>PAN: {company.pan_number}</span>}
          </div>
        </div>

        {/* Voucher Meta */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-semibold">Voucher No:</span>{" "}
                <span className="font-mono font-bold">{voucherNo}</span>
              </p>
              {expense.bill_reference && (
                <p className="text-sm">
                  <span className="font-semibold">Bill / Ref No:</span>{" "}
                  {expense.bill_reference}
                </p>
              )}
              <p className="text-sm">
                <span className="font-semibold">Status:</span>{" "}
                {statusLabel[expense.approval_status] || expense.approval_status}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm">
                <span className="font-semibold">Expense Date:</span>{" "}
                {expDateFormatted}
              </p>
              {payDateFormatted && (
                <p className="text-sm">
                  <span className="font-semibold">Payment Date:</span>{" "}
                  {payDateFormatted}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Account Head Table */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-1 font-semibold w-[50%]">
                  Account Head (Nature of Expense)
                </th>
                <th className="text-left py-1 font-semibold w-[25%]">Dr / Cr</th>
                <th className="text-right py-1 font-semibold w-[25%]">Amount (&#8377;)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2">
                  <span className="font-medium">
                    {expense.category?.name || "General Expense"}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">{expense.description}</p>
                </td>
                <td className="py-2 font-medium">Dr.</td>
                <td className="py-2 text-right font-bold tabular-nums">
                  {formatINR(expense.amount)}
                </td>
              </tr>
              <tr className="border-t border-gray-400">
                <td
                  className="py-1 text-right font-semibold pr-4"
                  colSpan={2}
                >
                  To Cash / Bank A/c
                </td>
                <td className="py-1 text-right font-bold tabular-nums">
                  Cr. {formatINR(expense.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in Words + Payment Mode */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-600 mb-0.5">Amount in Words (Rupees):</p>
            <p className="text-sm font-medium italic border-b border-dashed border-gray-400 pb-1">
              {amountInWords}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-600">Payment Mode</p>
              <p className="text-sm font-medium">{paymentMode}</p>
              {expense.cashbook && (
                <p className="text-xs text-gray-500">
                  via {expense.cashbook.name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Net Amount Payable</p>
              <p className="text-2xl font-bold tabular-nums border-2 border-gray-800 px-4 py-1 rounded">
                {formatINR(expense.amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Narration */}
        {expense.notes && (
          <div className="border-b-2 border-gray-800 print-border px-6 py-3">
            <p className="text-xs text-gray-600 mb-1">Narration / Remarks:</p>
            <p className="text-sm">{expense.notes}</p>
          </div>
        )}

        {/* Approval Trail */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Approval Trail
          </p>
          <div className="flex gap-6 text-xs">
            {[
              { key: "submitted", label: "Submitted" },
              { key: "branch_approved", label: "Branch" },
              { key: "accounts_approved", label: "Accounts" },
              { key: "owner_approved", label: "Owner" },
            ].map(({ key, label }) => {
              const idx = stageOrder.indexOf(key);
              const isApproved = idx <= currentStageIndex && currentStageIndex >= 0;
              return (
                <div key={key} className="text-center flex-1">
                  <div
                    className={`w-full h-8 border flex items-center justify-center font-medium text-sm ${
                      isApproved
                        ? "border-gray-800 bg-gray-100"
                        : "border-dashed border-gray-400"
                    }`}
                  >
                    {isApproved ? "\u2713" : ""}
                  </div>
                  <p className="mt-1 text-gray-600">{label}</p>
                </div>
              );
            })}
          </div>
          {expense.approval_status === "paid_direct" && (
            <p className="mt-2 text-xs text-red-600 font-medium">
              &#9888; This expense was paid directly by cashier without completing the approval workflow.
            </p>
          )}
        </div>

        {/* Signature Block */}
        <div className="px-6 py-8">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1" />
              <p className="text-xs font-medium">Prepared By</p>
              {expense.submitter?.full_name && (
                <p className="text-xs text-gray-500">{expense.submitter.full_name}</p>
              )}
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1" />
              <p className="text-xs font-medium">Checked By</p>
              <p className="text-xs text-gray-400">(Accounts Dept.)</p>
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1" />
              <p className="text-xs font-medium">Authorised By</p>
              <p className="text-xs text-gray-400">(Management)</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 px-6 py-2">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="font-mono">ID: {expense.id.substring(0, 16)}...</span>
            <span>Computer generated payment voucher</span>
          </div>
        </div>
      </div>
    </>
  );
}
