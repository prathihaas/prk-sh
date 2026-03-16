"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { ITEM_TYPE_LABELS, TRANSFER_TYPE_LABELS } from "@/lib/validators/transfer";

interface TransferItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_value: number;
  vin_chassis_number: string | null;
  engine_number: string | null;
  notes: string | null;
}

interface TransferChallan {
  id: string;
  challan_number: string;
  issued_at: string;
}

interface BranchInfo {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
}

interface CompanyInfo {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  gst_number?: string | null;
}

interface PrintTransferChallanProps {
  transfer: {
    id: string;
    transfer_type: string;
    transfer_date: string;
    status: string;
    narration: string | null;
    total_value: number;
    items: TransferItem[];
    challans: TransferChallan[];
  };
  fromCompany: CompanyInfo;
  fromBranch: BranchInfo;
  toCompany: CompanyInfo;
  toBranch: BranchInfo;
}

export function PrintTransferChallan({
  transfer,
  fromCompany,
  fromBranch,
  toCompany,
  toBranch,
}: PrintTransferChallanProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const challan = transfer.challans?.[0];

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Transfer Challan ${challan?.challan_number ?? transfer.id}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
            .page { width: 210mm; min-height: 297mm; padding: 14mm; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
            .logo { max-height: 50px; object-fit: contain; margin-bottom: 6px; }
            .company-name { font-size: 18px; font-weight: bold; }
            .challan-title { font-size: 14px; font-weight: bold; letter-spacing: 1px; margin: 6px 0 2px; }
            .challan-num { font-size: 12px; color: #444; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
            .meta-box { border: 1px solid #ccc; border-radius: 4px; padding: 8px 10px; }
            .meta-box h4 { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
            .meta-box p { font-weight: bold; font-size: 11px; }
            .meta-box small { color: #555; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
            td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; font-size: 11px; }
            tr:nth-child(even) { background: #fafafa; }
            .totals { text-align: right; margin: 8px 0; font-size: 12px; }
            .totals strong { font-size: 14px; }
            .notes { border: 1px solid #ccc; padding: 8px 10px; border-radius: 4px; margin: 12px 0; font-size: 10px; color: #444; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; }
            .sig-box { border-top: 1px solid #111; padding-top: 6px; text-align: center; font-size: 10px; color: #555; }
            .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 10px; font-size: 9px; font-weight: bold; }
            @media print { .page { padding: 10mm; } }
          </style>
        </head>
        <body>
          <div class="page">
            ${el.innerHTML}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  const transferDate = new Date(transfer.transfer_date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" />
        Print Transfer Challan
      </Button>

      {/* Hidden printable area */}
      <div ref={printRef} className="hidden">
        {/* Header */}
        <div className="header">
          {fromCompany.logo_url && (
            <img src={fromCompany.logo_url} alt={fromCompany.name} className="logo" />
          )}
          <div className="company-name">{fromCompany.name}</div>
          {fromCompany.gst_number && (
            <div style={{ fontSize: "11px", fontWeight: "bold", marginTop: "2px" }}>
              GSTIN: {fromCompany.gst_number}
            </div>
          )}
          {fromBranch.address && <div style={{ fontSize: "10px", color: "#555" }}>{fromBranch.address}</div>}
          <div className="challan-title">TRANSFER CHALLAN</div>
          <div className="challan-num">
            {challan ? (
              <>Challan No: <strong>{challan.challan_number}</strong></>
            ) : (
              <>Transfer ID: {transfer.id.slice(0, 8).toUpperCase()}</>
            )}
          </div>
          <div style={{ fontSize: "10px", marginTop: "2px" }}>
            Date: {transferDate} &nbsp;|&nbsp;
            Type: {TRANSFER_TYPE_LABELS[transfer.transfer_type] ?? transfer.transfer_type} &nbsp;|&nbsp;
            Status: <span className="badge">{transfer.status.toUpperCase()}</span>
          </div>
        </div>

        {/* From / To */}
        <div className="meta-grid">
          <div className="meta-box">
            <h4>From</h4>
            <p>{fromCompany.name}</p>
            <small>{fromBranch.name}</small>
            {fromBranch.address && <div><small>{fromBranch.address}</small></div>}
            {fromBranch.phone && <div><small>Ph: {fromBranch.phone}</small></div>}
          </div>
          <div className="meta-box">
            <h4>To</h4>
            <p>{toCompany.name}</p>
            <small>{toBranch.name}</small>
            {toBranch.address && <div><small>{toBranch.address}</small></div>}
            {toBranch.phone && <div><small>Ph: {toBranch.phone}</small></div>}
          </div>
        </div>

        {/* Items Table */}
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Description</th>
              <th>Chassis / VIN</th>
              <th>Engine No.</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Value (₹)</th>
              <th>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>{ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}</td>
                <td>{item.description}</td>
                <td>{item.vin_chassis_number ?? "—"}</td>
                <td>{item.engine_number ?? "—"}</td>
                <td>{item.quantity}</td>
                <td>{item.unit ?? "Nos"}</td>
                <td>{item.unit_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td>{(item.unit_value * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          Total Transfer Value: <strong>₹{transfer.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </div>

        {transfer.narration && (
          <div className="notes">
            <strong>Notes:</strong> {transfer.narration}
          </div>
        )}

        {/* Signatures */}
        <div className="signatures">
          <div className="sig-box">Prepared By</div>
          <div className="sig-box">Dispatched By<br />(From Branch)</div>
          <div className="sig-box">Received By<br />(To Branch)</div>
        </div>
      </div>
    </div>
  );
}
