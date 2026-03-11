"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/currency-display";
import { amountToIndianWords } from "@/lib/utils/number-to-words";

interface PrintReceiptProps {
  transaction: {
    id: string;
    receipt_number: string;
    voucher_number: string | null;
    txn_type: string;
    amount: number;
    running_balance: number;
    party_name: string | null;
    narration: string;
    payment_mode: string;
    receipt_hash: string;
    created_at: string;
    is_voided: boolean;
    void_reason?: string | null;
    voided_at?: string | null;
  };
  company: {
    name: string;
    gst_number: string | null;
    address: string | null;
    logo_url?: string | null;
  } | null;
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
  } | null;
  cashbook: {
    name: string;
  } | null;
}

export function PrintReceipt({
  transaction,
  company,
  branch,
  cashbook,
}: PrintReceiptProps) {
  const dateFormatted = new Date(transaction.created_at).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "short", year: "numeric" }
  );
  const timeFormatted = new Date(transaction.created_at).toLocaleTimeString(
    "en-IN",
    { hour: "2-digit", minute: "2-digit" }
  );
  const amountInWords = amountToIndianWords(transaction.amount);
  const paymentMode = transaction.payment_mode
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const hashShort = transaction.receipt_hash
    ? transaction.receipt_hash.substring(0, 16) + "..."
    : "N/A";

  return (
    <>
      {/* Print-specific styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-receipt-area,
              #print-receipt-area * {
                visibility: visible !important;
              }
              #print-receipt-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: A5 portrait;
                margin: 8mm;
              }
              .no-print {
                display: none !important;
              }
              .print-border {
                border-color: #000 !important;
              }
            }
          `,
        }}
      />

      {/* Print Button */}
      <div className="no-print flex items-center gap-3 mb-4">
        <Button onClick={() => window.print()} size="lg">
          <Printer className="mr-2 h-5 w-5" />
          Print Receipt
        </Button>
        <span className="text-sm text-muted-foreground">
          Prints in A5 format (standard receipt book size)
        </span>
      </div>

      {/* Receipt Card */}
      <div
        id="print-receipt-area"
        className="relative mx-auto max-w-[600px] border-2 border-gray-800 dark:border-gray-200 bg-white dark:bg-white text-black rounded-sm print-border"
      >
        {/* Voided Overlay */}
        {transaction.is_voided && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-red-500 text-7xl font-extrabold opacity-20 -rotate-45 select-none tracking-[0.3em]">
              VOID
            </span>
          </div>
        )}

        {/* ── Header ── */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-4 text-center">
          {company?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-12 object-contain mx-auto mb-2"
            />
          )}
          <h1 className="text-2xl font-bold tracking-widest mb-1">RECEIPT</h1>
          {company && (
            <h2 className="text-lg font-semibold">{company.name}</h2>
          )}
          {branch && (
            <p className="text-sm">
              {branch.name}
              {branch.address ? ` \u2022 ${branch.address}` : ""}
            </p>
          )}
          {branch?.phone && (
            <p className="text-xs text-gray-600">Tel: {branch.phone}</p>
          )}
          {company?.gst_number && (
            <p className="text-sm font-medium mt-1">
              GSTIN: {company.gst_number}
            </p>
          )}
        </div>

        {/* ── Receipt Metadata ── */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm">
                <span className="font-semibold">Receipt No:</span>{" "}
                <span className="font-mono">{transaction.receipt_number}</span>
              </p>
              {transaction.voucher_number && (
                <p className="text-sm">
                  <span className="font-semibold">Voucher No:</span>{" "}
                  <span className="font-mono">
                    {transaction.voucher_number}
                  </span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm">
                <span className="font-semibold">Date:</span> {dateFormatted}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Time:</span> {timeFormatted}
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4 min-h-[220px]">
          {/* Received From */}
          <div>
            <p className="text-sm text-gray-600">Received with thanks from:</p>
            <p className="text-lg font-semibold border-b border-dashed border-gray-400 pb-1 mt-1">
              {transaction.party_name
                ? `Shri/Smt. ${transaction.party_name}`
                : "—"}
            </p>
          </div>

          {/* Amount in Words */}
          <div>
            <p className="text-sm text-gray-600">The sum of Rupees:</p>
            <p className="text-base font-medium italic border-b border-dashed border-gray-400 pb-1 mt-1">
              {amountInWords}
            </p>
          </div>

          {/* Amount in Figures + Payment Mode */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-600">Payment Mode</p>
              <p className="text-base font-medium">{paymentMode}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Amount</p>
              <p className="text-2xl font-bold tabular-nums border-2 border-gray-800 px-4 py-1 rounded">
                {formatINR(transaction.amount)}
              </p>
            </div>
          </div>

          {/* Narration / Towards */}
          <div>
            <p className="text-sm text-gray-600">Towards:</p>
            <p className="text-sm border-b border-dashed border-gray-400 pb-1 mt-1">
              {transaction.narration}
            </p>
          </div>
        </div>

        {/* ── Balance ── */}
        <div className="border-t-2 border-b-2 border-gray-800 print-border px-6 py-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Running Balance:</span>
            <span className="text-base font-bold tabular-nums">
              {formatINR(transaction.running_balance)}
            </span>
          </div>
        </div>

        {/* ── Signature Block ── */}
        <div className="px-6 py-6">
          <div className="flex justify-between items-end mt-8">
            <div className="text-center">
              <div className="w-40 border-b border-gray-800 mb-1" />
              <p className="text-xs font-medium">Received By</p>
            </div>
            <div className="text-center">
              <div className="w-40 border-b border-gray-800 mb-1" />
              <p className="text-xs font-medium">Authorised Signatory</p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-300 px-6 py-2">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="font-mono" title={transaction.receipt_hash}>
              Hash: {hashShort}
            </span>
            {cashbook && <span>Cashbook: {cashbook.name}</span>}
          </div>
        </div>

        {/* Voided Info */}
        {transaction.is_voided && (
          <div className="border-t-2 border-red-500 bg-red-50 px-6 py-3">
            <p className="text-sm font-bold text-red-700">
              VOIDED
            </p>
            {transaction.void_reason && (
              <p className="text-xs text-red-600 mt-1">
                Reason: {transaction.void_reason}
              </p>
            )}
            {transaction.voided_at && (
              <p className="text-xs text-red-500 mt-0.5">
                Voided on:{" "}
                {new Date(transaction.voided_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
