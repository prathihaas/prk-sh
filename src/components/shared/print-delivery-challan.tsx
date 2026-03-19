"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/currency-display";

interface PrintDeliveryChallanProps {
  invoice: {
    id: string;
    dms_invoice_number?: string | null;
    invoice_date: string;
    invoice_type: string;
    customer_name: string;
    customer_phone?: string | null;
    customer_address?: string | null;
    vehicle_model?: string | null;
    vehicle_variant?: string | null;
    vin_number?: string | null;
    engine_number?: string | null;
    tractor_model?: string | null;
    chassis_number?: string | null;
    grand_total: number;
    delivery_challan_number?: string | null;
    delivery_challan_date?: string | null;
    delivery_address?: string | null;
    narration?: string | null;
    notes?: string | null;
  };
  company: {
    name: string;
    gstin?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null;
  branch: {
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  automobile_sale: "Vehicle Sale",
  automobile: "Vehicle Sale",
  tractor_agri_sale: "Tractor / Agri Sale",
  tractor: "Tractor / Agri Sale",
  service: "Vehicle Service",
  spares_counter_sale: "Spares Counter Sale",
  bank_payment: "Bank Payment",
  other_income: "Other Income",
};

export function PrintDeliveryChallan({ invoice, company, branch }: PrintDeliveryChallanProps) {
  const challanDate = invoice.delivery_challan_date
    ? new Date(invoice.delivery_challan_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const invoiceDateFormatted = new Date(invoice.invoice_date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const itemDescription =
    invoice.vehicle_model
      ? `${invoice.vehicle_model}${invoice.vehicle_variant ? ` (${invoice.vehicle_variant})` : ""}`
      : invoice.tractor_model
      ? invoice.tractor_model
      : "As per invoice";

  const printStyles = `
    @media print {
      body * { visibility: hidden !important; }
      #print-challan-area, #print-challan-area * { visibility: visible !important; color: black !important; }
      #print-challan-area {
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

      <div className="no-print flex items-center gap-3 mb-4">
        <Button onClick={() => window.print()} size="lg">
          <Printer className="mr-2 h-5 w-5" />
          Print Gate Pass
        </Button>
        <span className="text-sm text-muted-foreground">A4 format</span>
      </div>

      <div
        id="print-challan-area"
        className="mx-auto max-w-[720px] border-2 border-gray-800 dark:border-gray-200 bg-white dark:bg-white text-black rounded-sm print-border"
      >
        {/* Header */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-4 text-center">
          {company?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.name} className="h-12 object-contain mx-auto mb-2" />
          )}
          <h1 className="text-xl font-bold tracking-widest mb-1">GATE PASS</h1>
          {company && <h2 className="text-lg font-semibold">{company.name}</h2>}
          {branch && (
            <p className="text-sm font-medium">Branch: {branch.name}</p>
          )}
          {branch?.address && (
            <p className="text-xs text-gray-600">{branch.address}</p>
          )}
          {branch?.phone && <p className="text-xs text-gray-600">Tel: {branch.phone}</p>}
          {company?.gstin && (
            <p className="text-sm font-medium mt-1">GSTIN: {company.gstin}</p>
          )}
        </div>

        {/* Gate Pass Meta */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-semibold">Gate Pass No:</span>{" "}
                <span className="font-mono font-bold">
                  {invoice.delivery_challan_number || "DC/PENDING"}
                </span>
              </p>
              {invoice.dms_invoice_number && (
                <p className="text-sm">
                  <span className="font-semibold">Invoice No:</span> {invoice.dms_invoice_number}
                </p>
              )}
              <p className="text-sm">
                <span className="font-semibold">Invoice Date:</span> {invoiceDateFormatted}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Type:</span>{" "}
                {INVOICE_TYPE_LABELS[invoice.invoice_type] || invoice.invoice_type}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm">
                <span className="font-semibold">Gate Pass Date:</span> {challanDate}
              </p>
            </div>
          </div>
        </div>

        {/* Consignee */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Consignee (Delivery To)
          </h3>
          <p className="text-base font-semibold">{invoice.customer_name}</p>
          {invoice.customer_phone && (
            <p className="text-sm text-gray-700">Tel: {invoice.customer_phone}</p>
          )}
          {(invoice.delivery_address || invoice.customer_address) && (
            <p className="text-sm text-gray-700 mt-1">
              {invoice.delivery_address || invoice.customer_address}
            </p>
          )}
        </div>

        {/* Item Table */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-2 font-semibold w-8">S.No</th>
                <th className="text-left py-2 font-semibold">Item Description</th>
                <th className="text-left py-2 font-semibold w-28">VIN / Chassis</th>
                <th className="text-left py-2 font-semibold w-24">Engine No</th>
                <th className="text-right py-2 font-semibold w-28">Value (&#8377;)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-2">1</td>
                <td className="py-2 font-medium">{itemDescription}</td>
                <td className="py-2 font-mono text-xs">
                  {invoice.vin_number || invoice.chassis_number || "—"}
                </td>
                <td className="py-2 font-mono text-xs">{invoice.engine_number || "—"}</td>
                <td className="py-2 text-right font-bold tabular-nums">
                  {formatINR(invoice.grand_total)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="py-2 text-right font-semibold pr-4">Total Value</td>
                <td className="py-2 text-right font-bold tabular-nums border-t-2 border-gray-800">
                  {formatINR(invoice.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Narration / Remarks — always shown */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <p className="text-xs text-gray-600 mb-0.5">Narration / Remarks:</p>
          <p className="text-sm border-b border-dashed border-gray-400 pb-1">
            {invoice.narration || invoice.notes || "—"}
          </p>
        </div>

        {/* Terms */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Terms &amp; Conditions:</span> E.&amp;O.E. — This
            gate pass is subject to the terms of the original invoice. Goods once delivered
            cannot be returned without prior authorization. Subject to local jurisdiction.
          </p>
        </div>

        {/* Signature Block */}
        <div className="px-6 py-8">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1 mt-12" />
              <p className="text-xs font-medium">Receiver&apos;s Signature</p>
              <p className="text-xs text-gray-500">Name &amp; Date</p>
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1 mt-12" />
              <p className="text-xs font-medium">Dispatched By</p>
              <p className="text-xs text-gray-500">{company?.name || "Authorised Signatory"}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 px-6 py-2">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="font-mono">Invoice ID: {invoice.id.substring(0, 16)}...</span>
            <span>Computer generated gate pass</span>
          </div>
        </div>
      </div>
    </>
  );
}
