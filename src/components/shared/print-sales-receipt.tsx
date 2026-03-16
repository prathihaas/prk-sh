"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/currency-display";

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  bank_transfer: "Bank Transfer / NEFT / RTGS",
  card: "Debit / Credit Card",
  finance: "Finance / Loan",
  credit: "Credit (Pay Later)",
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  automobile_sale: "Vehicle Sale",
  tractor_agri_sale: "Tractor / Agri Equipment Sale",
  service: "Vehicle Service",
  spares_counter_sale: "Spares Counter Sales",
  other_income: "Other Income",
};

interface PrintSalesReceiptProps {
  invoice: {
    id: string;
    dms_invoice_number?: string | null;
    invoice_date: string;
    invoice_type: string;
    customer_name: string;
    customer_phone?: string | null;
    customer_gstin?: string | null;
    customer_address?: string | null;
    vehicle_model?: string | null;
    vehicle_variant?: string | null;
    vin_number?: string | null;
    engine_number?: string | null;
    tractor_model?: string | null;
    chassis_number?: string | null;
    base_amount?: number;
    discount_amount?: number;
    tax_breakup?: {
      cgst?: number;
      sgst?: number;
      igst?: number;
      tcs?: number;
      cess?: number;
    } | null;
    grand_total: number;
    notes?: string | null;
  };
  payment: {
    payment_mode: string;
    amount: number;
    reference_number?: string | null;
    payment_date: string;
  } | null;
  company: {
    name: string;
    gst_number?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null;
  branch: {
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
}

const printStyles = `
  @media print {
    body * { visibility: hidden !important; }
    #print-sales-receipt-area, #print-sales-receipt-area * { visibility: visible !important; }
    #print-sales-receipt-area {
      position: absolute; left: 0; top: 0; width: 100%;
      background: white !important; color: black !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 12mm; }
    .no-print { display: none !important; }
    .print-border { border-color: #000 !important; }
  }
`;

export function PrintSalesReceipt({
  invoice,
  payment,
  company,
  branch,
}: PrintSalesReceiptProps) {
  const invoiceDateFormatted = new Date(invoice.invoice_date).toLocaleDateString(
    "en-IN", { day: "2-digit", month: "short", year: "numeric" }
  );

  const paymentDateFormatted = payment
    ? new Date(payment.payment_date).toLocaleDateString(
        "en-IN", { day: "2-digit", month: "short", year: "numeric" }
      )
    : invoiceDateFormatted;

  const vehicleDescription =
    invoice.vehicle_model
      ? `${invoice.vehicle_model}${invoice.vehicle_variant ? ` (${invoice.vehicle_variant})` : ""}`
      : invoice.tractor_model || null;

  const base = invoice.base_amount ?? invoice.grand_total;
  const discount = invoice.discount_amount ?? 0;
  const cgst = invoice.tax_breakup?.cgst ?? 0;
  const sgst = invoice.tax_breakup?.sgst ?? 0;
  const igst = invoice.tax_breakup?.igst ?? 0;
  const tcs = invoice.tax_breakup?.tcs ?? 0;
  const taxTotal = cgst + sgst + igst + tcs;
  const hasVehicle = Boolean(vehicleDescription || invoice.vin_number || invoice.chassis_number || invoice.engine_number);
  const hasTax = taxTotal > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="no-print flex items-center gap-3 mb-4">
        <Button onClick={() => window.print()} size="lg">
          <Printer className="mr-2 h-5 w-5" />
          Print Sales Receipt
        </Button>
        <span className="text-sm text-muted-foreground">A4 format</span>
      </div>

      <div
        id="print-sales-receipt-area"
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
          <h1 className="text-xl font-bold tracking-widest mb-1">SALES RECEIPT</h1>
          {company && <h2 className="text-lg font-semibold">{company.name}</h2>}
          {branch && (
            <p className="text-sm">
              {branch.name}{branch.address ? ` \u2022 ${branch.address}` : ""}
            </p>
          )}
          {branch?.phone && (
            <p className="text-xs text-gray-600">Tel: {branch.phone}</p>
          )}
          {company?.gst_number && (
            <p className="text-sm font-medium mt-1">GSTIN: {company.gst_number}</p>
          )}
        </div>

        {/* Receipt Meta */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              {invoice.dms_invoice_number && (
                <p className="text-sm">
                  <span className="font-semibold">Invoice No:</span>{" "}
                  <span className="font-bold">{invoice.dms_invoice_number}</span>
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
              <p className="text-xs text-gray-500 font-mono">
                Ref: {invoice.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Bill To
          </h3>
          <p className="text-base font-semibold">{invoice.customer_name}</p>
          {invoice.customer_phone && (
            <p className="text-sm text-gray-700">Tel: {invoice.customer_phone}</p>
          )}
          {invoice.customer_address && (
            <p className="text-sm text-gray-700 mt-0.5">{invoice.customer_address}</p>
          )}
          {invoice.customer_gstin && (
            <p className="text-sm text-gray-700 mt-0.5">
              GSTIN: <span className="font-mono">{invoice.customer_gstin}</span>
            </p>
          )}
        </div>

        {/* Vehicle / Item Details */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-2 font-semibold w-8">S.No</th>
                <th className="text-left py-2 font-semibold">Description</th>
                {hasVehicle && (
                  <>
                    <th className="text-left py-2 font-semibold w-32">VIN / Chassis</th>
                    <th className="text-left py-2 font-semibold w-28">Engine No</th>
                  </>
                )}
                <th className="text-right py-2 font-semibold w-28">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-2">1</td>
                <td className="py-2 font-medium">
                  {vehicleDescription || INVOICE_TYPE_LABELS[invoice.invoice_type] || "As per invoice"}
                </td>
                {hasVehicle && (
                  <>
                    <td className="py-2 font-mono text-xs">
                      {invoice.vin_number || invoice.chassis_number || "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {invoice.engine_number || "—"}
                    </td>
                  </>
                )}
                <td className="py-2 text-right tabular-nums">{formatINR(base)}</td>
              </tr>

              {/* Amounts breakdown */}
              {discount > 0 && (
                <tr className="border-b border-gray-100">
                  <td colSpan={hasVehicle ? 4 : 2} className="py-1 text-right text-gray-600 pr-4 text-xs">
                    Discount
                  </td>
                  <td className="py-1 text-right tabular-nums text-red-700 text-xs">
                    ({formatINR(discount)})
                  </td>
                </tr>
              )}

              {hasTax && (
                <>
                  {cgst > 0 && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={hasVehicle ? 4 : 2} className="py-1 text-right text-gray-600 pr-4 text-xs">CGST</td>
                      <td className="py-1 text-right tabular-nums text-xs">{formatINR(cgst)}</td>
                    </tr>
                  )}
                  {sgst > 0 && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={hasVehicle ? 4 : 2} className="py-1 text-right text-gray-600 pr-4 text-xs">SGST</td>
                      <td className="py-1 text-right tabular-nums text-xs">{formatINR(sgst)}</td>
                    </tr>
                  )}
                  {igst > 0 && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={hasVehicle ? 4 : 2} className="py-1 text-right text-gray-600 pr-4 text-xs">IGST</td>
                      <td className="py-1 text-right tabular-nums text-xs">{formatINR(igst)}</td>
                    </tr>
                  )}
                  {tcs > 0 && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={hasVehicle ? 4 : 2} className="py-1 text-right text-gray-600 pr-4 text-xs">TCS</td>
                      <td className="py-1 text-right tabular-nums text-xs">{formatINR(tcs)}</td>
                    </tr>
                  )}
                </>
              )}

              <tr>
                <td
                  colSpan={hasVehicle ? 4 : 2}
                  className="py-2 text-right font-bold pr-4"
                >
                  Total Amount
                </td>
                <td className="py-2 text-right font-bold tabular-nums border-t-2 border-gray-800">
                  {formatINR(invoice.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Details */}
        {payment && (
          <div className="border-b-2 border-gray-800 print-border px-6 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
              Payment Received
            </h3>
            <div className="flex items-start justify-between gap-4 text-sm">
              <div className="space-y-1">
                <p>
                  <span className="font-semibold">Mode:</span>{" "}
                  {PAYMENT_MODE_LABELS[payment.payment_mode] || payment.payment_mode}
                </p>
                <p>
                  <span className="font-semibold">Date:</span> {paymentDateFormatted}
                </p>
                {payment.reference_number && (
                  <p>
                    <span className="font-semibold">Reference:</span>{" "}
                    <span className="font-mono">{payment.reference_number}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">Amount Paid</p>
                <p className="text-lg font-bold tabular-nums">{formatINR(payment.amount)}</p>
                <p className="text-xs text-green-700 font-semibold mt-0.5">PAID IN FULL</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="border-b-2 border-gray-800 print-border px-6 py-3">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Notes:</span> {invoice.notes}
            </p>
          </div>
        )}

        {/* Terms */}
        <div className="border-b-2 border-gray-800 print-border px-6 py-3">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Terms &amp; Conditions:</span> E.&amp;O.E. — This
            receipt is computer generated and is valid without a signature. Payment received in full
            against the above invoice. Subject to local jurisdiction.
          </p>
        </div>

        {/* Signature Block */}
        <div className="px-6 py-8">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1 mt-12" />
              <p className="text-xs font-medium">Customer Signature</p>
              <p className="text-xs text-gray-500">{invoice.customer_name}</p>
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-gray-800 mb-1 mt-12" />
              <p className="text-xs font-medium">Authorised Signatory</p>
              <p className="text-xs text-gray-500">{company?.name || "For the Company"}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 px-6 py-2">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="font-mono">Receipt ID: {invoice.id.substring(0, 16)}...</span>
            <span>Computer generated sales receipt</span>
          </div>
        </div>
      </div>
    </>
  );
}
