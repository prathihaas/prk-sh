"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Receipt,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  BadgeDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CustomerPickerWithCreate,
  type CustomerOption,
} from "@/components/shared/customer-picker";
import { submitSalesReceiptForm } from "@/lib/queries/sales-receipts";

// ── Types ────────────────────────────────────────────────────────────────────

interface SalesReceiptFormProps {
  userId: string;
  companyId: string;
  branchId: string;
  financialYearId: string;
  customers: CustomerOption[];
  cashbooks: { id: string; name: string }[];
  insuranceCompanies: string[];
  financeCompanies: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INVOICE_TYPES = [
  { value: "automobile_sale", label: "Sales" },
  { value: "service", label: "Vehicle Service" },
  { value: "spares_counter_sale", label: "Spares Counter Sales" },
  { value: "other_income", label: "Other Income" },
] as const;

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer / NEFT / RTGS" },
  { value: "card", label: "Debit / Credit Card" },
  { value: "finance", label: "Finance / Loan" },
  { value: "credit", label: "Credit (Pay Later)" },
] as const;

function formatINR(val: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SalesReceiptForm({
  userId,
  companyId,
  branchId,
  financialYearId,
  customers,
  cashbooks,
  insuranceCompanies,
  financeCompanies,
}: SalesReceiptFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showTax, setShowTax] = useState(false);

  // ── Core fields ──────────────────────────────────────────────────────────
  const [invoiceType, setInvoiceType] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dmsInvoiceNumber, setDmsInvoiceNumber] = useState("");

  // ── Customer ─────────────────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");

  // ── Vehicle fields (automobile / tractor sale) ───────────────────────────
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleVariant, setVehicleVariant] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");

  // ── Insurance (service type only) ────────────────────────────────────────
  const [insuranceDue, setInsuranceDue] = useState(false);
  const [insuranceCompany, setInsuranceCompany] = useState<string>("");

  // ── Finance (vehicle sale types only) ────────────────────────────────────
  const [financeDue, setFinanceDue] = useState(false);
  const [financeCompany, setFinanceCompany] = useState<string>("");
  const [financeAmount, setFinanceAmount] = useState("");

  // ── Insurance amount (receivable from insurance company) ─────────────────
  const [insuranceAmount, setInsuranceAmount] = useState("");

  // ── Amounts ──────────────────────────────────────────────────────────────
  const [baseAmount, setBaseAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [taxCgst, setTaxCgst] = useState("");
  const [taxSgst, setTaxSgst] = useState("");
  const [taxIgst, setTaxIgst] = useState("");
  const [taxTcs, setTaxTcs] = useState("");

  // ── Payment ──────────────────────────────────────────────────────────────
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [cashbookId, setCashbookId] = useState<string>("");

  // ── Notes ────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── Derived booleans ─────────────────────────────────────────────────────
  const isVehicleType = invoiceType === "automobile_sale";
  const isServiceType = invoiceType === "service";
  const isSpares = invoiceType === "spares_counter_sale";

  // ── Grand total calculation ───────────────────────────────────────────────
  const base = parseFloat(baseAmount) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const cgst = parseFloat(taxCgst) || 0;
  const sgst = parseFloat(taxSgst) || 0;
  const igst = parseFloat(taxIgst) || 0;
  const tcs = parseFloat(taxTcs) || 0;
  const grandTotal = base - discount + cgst + sgst + igst + tcs;

  // ── Customer pays (net of finance / insurance deductions) ────────────────
  const finAmt = financeDue ? (parseFloat(financeAmount) || 0) : 0;
  const insAmt = insuranceDue ? (parseFloat(insuranceAmount) || 0) : 0;
  const customerAmount = grandTotal - finAmt - insAmt;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleCustomerSelect(customer: CustomerOption | null) {
    if (customer) {
      setCustomerId(customer.id);
      setCustomerName(customer.full_name);
      setCustomerPhone(customer.phone || "");
      setCustomerGstin(customer.gstin || "");
    } else {
      setCustomerId("");
    }
  }

  function handleInvoiceTypeChange(val: string) {
    setInvoiceType(val);
    // Reset type-specific fields when type changes
    setInsuranceDue(false);
    setInsuranceCompany("");
    setInsuranceAmount("");
    setFinanceDue(false);
    setFinanceCompany("");
    setFinanceAmount("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!invoiceType) {
      toast.error("Please select an invoice type.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (!baseAmount || base <= 0) {
      toast.error("Sale amount must be greater than zero.");
      return;
    }
    if (!paymentMode) {
      toast.error("Please select a payment mode.");
      return;
    }
    if (paymentMode === "cash") {
      if (cashbooks.length === 0) {
        toast.error("No active cash cashbook found for this branch. Cannot accept cash payment — please configure a cashbook first.");
        return;
      }
      if (!cashbookId) {
        toast.error("Please select a cashbook for cash payment.");
        return;
      }
    }
    // Reference required for non-cash, non-credit payments
    if (paymentMode !== "cash" && paymentMode !== "credit" && !paymentReference.trim()) {
      toast.error("Payment reference is required for non-cash payments (e.g. cheque number, UPI ID, transaction ref).");
      return;
    }
    if (insuranceDue && !insuranceCompany) {
      toast.error("Please select an insurance company.");
      return;
    }
    if (financeDue && !financeCompany) {
      toast.error("Please select a finance company.");
      return;
    }

    startTransition(async () => {
      // submitSalesReceiptForm either returns { error } on failure,
      // or calls redirect() on success (which Next.js 15 handles as a
      // navigation response — this await never resolves in that case).
      const result = await submitSalesReceiptForm({
        invoice_type: invoiceType as
          | "automobile_sale"
          | "service"
          | "spares_counter_sale"
          | "other_income",
        invoice_date: invoiceDate,
        dms_invoice_number: dmsInvoiceNumber || undefined,
        customer_id: customerId || undefined,
        customer_name: customerName,
        customer_phone: customerPhone || undefined,
        customer_gstin: customerGstin || undefined,
        vehicle_model: vehicleModel || undefined,
        vehicle_variant: vehicleVariant || undefined,
        vin_number: vinNumber || undefined,
        engine_number: engineNumber || undefined,
        base_amount: base,
        discount_amount: discount || undefined,
        tax_cgst: cgst || undefined,
        tax_sgst: sgst || undefined,
        tax_igst: igst || undefined,
        tax_tcs: tcs || undefined,
        payment_mode: paymentMode as
          | "cash"
          | "cheque"
          | "upi"
          | "bank_transfer"
          | "card"
          | "finance"
          | "credit",
        payment_reference: paymentReference || undefined,
        cashbook_id: cashbookId || undefined,
        insurance_due: insuranceDue || undefined,
        insurance_company: insuranceDue ? insuranceCompany : undefined,
        insurance_amount:
          insuranceDue && insuranceAmount ? parseFloat(insuranceAmount) : undefined,
        finance_due: financeDue || undefined,
        finance_company: financeDue ? financeCompany : undefined,
        finance_amount:
          financeDue && financeAmount ? parseFloat(financeAmount) : undefined,
        notes: notes || undefined,
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        created_by: userId,
      });

      // Only reached when the action returned without redirecting (i.e. an error)
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Invoice Details ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice Type *</Label>
              <Select value={invoiceType} onValueChange={handleInvoiceTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice_date">Invoice Date *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dms_number">DMS Invoice Number</Label>
              <Input
                id="dms_number"
                placeholder="e.g. INV/2025-26/0001"
                value={dmsInvoiceNumber}
                onChange={(e) => setDmsInvoiceNumber(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Customer Details ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer Record</Label>
            <CustomerPickerWithCreate
              customers={customers}
              companyId={companyId}
              currentUserId={userId}
              value={customerId || undefined}
              onSelect={handleCustomerSelect}
              placeholder="Search or create customer…"
            />
            {customerId && (
              <p className="text-xs text-green-600">
                ✓ Linked to customer record — details auto-filled below
              </p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                placeholder="Full name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (customerId) setCustomerId("");
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer_phone">Phone Number</Label>
              <Input
                id="customer_phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer_gstin">Customer GSTIN</Label>
              <Input
                id="customer_gstin"
                placeholder="22AAAAA0000A1Z5"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Vehicle Details (automobile / tractor sale) ──────────────────────── */}
      {isVehicleType && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vehicle_model">Model</Label>
                <Input
                  id="vehicle_model"
                  placeholder="e.g. Maruti Brezza, Mahindra 575 DI"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle_variant">Variant / Specification</Label>
                <Input
                  id="vehicle_variant"
                  placeholder="e.g. ZXi+, 4WD"
                  value={vehicleVariant}
                  onChange={(e) => setVehicleVariant(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vin_number">VIN / Chassis Number</Label>
                <Input
                  id="vin_number"
                  placeholder="17-digit VIN"
                  value={vinNumber}
                  onChange={(e) => setVinNumber(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="engine_number">Engine Number</Label>
                <Input
                  id="engine_number"
                  placeholder="Engine serial number"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
            </div>

            {/* ── Finance section ──────────────────────────────────────────── */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="finance_due"
                  checked={financeDue}
                  onCheckedChange={(v) => {
                    setFinanceDue(Boolean(v));
                    if (!v) {
                      setFinanceCompany("");
                      setFinanceAmount("");
                    }
                  }}
                />
                <label
                  htmlFor="finance_due"
                  className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                >
                  <BadgeDollarSign className="h-4 w-4 text-blue-600" />
                  Finance / Loan Due
                </label>
              </div>

              {financeDue && (
                <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Finance Company *</Label>
                    {financeCompanies.length > 0 ? (
                      <Select
                        value={financeCompany}
                        onValueChange={setFinanceCompany}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select finance company…" />
                        </SelectTrigger>
                        <SelectContent>
                          {financeCompanies.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Finance company name"
                        value={financeCompany}
                        onChange={(e) => setFinanceCompany(e.target.value)}
                      />
                    )}
                    {financeCompanies.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Add more companies in Settings → Company Partners.
                      </p>
                    )}
                    {financeCompanies.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No companies configured.{" "}
                        <a
                          href="/settings/company-partners"
                          target="_blank"
                          className="underline underline-offset-2"
                        >
                          Add in Settings
                        </a>
                        .
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="finance_amount">Finance Amount (₹)</Label>
                    <Input
                      id="finance_amount"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={financeAmount}
                      onChange={(e) => setFinanceAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Service Vehicle Details ──────────────────────────────────────────── */}
      {isServiceType && (
        <Card>
          <CardHeader>
            <CardTitle>Service Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="svc_vehicle_model">Vehicle Model / Description</Label>
                <Input
                  id="svc_vehicle_model"
                  placeholder="e.g. Maruti Swift, Mahindra Thar"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_variant">Variant</Label>
                <Input
                  id="svc_variant"
                  placeholder="e.g. VXi, ZXi+"
                  value={vehicleVariant}
                  onChange={(e) => setVehicleVariant(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_vin">VIN / Chassis Number</Label>
                <Input
                  id="svc_vin"
                  placeholder="17-digit VIN or Chassis No."
                  value={vinNumber}
                  onChange={(e) => setVinNumber(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_engine">Engine Number</Label>
                <Input
                  id="svc_engine"
                  placeholder="Engine serial number"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
            </div>

            {/* ── Insurance section ────────────────────────────────────────── */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="insurance_due"
                  checked={insuranceDue}
                  onCheckedChange={(v) => {
                    setInsuranceDue(Boolean(v));
                    if (!v) setInsuranceCompany("");
                  }}
                />
                <label
                  htmlFor="insurance_due"
                  className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Insurance Due
                </label>
              </div>

              {insuranceDue && (
                <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Insurance Company *</Label>
                    {insuranceCompanies.length > 0 ? (
                      <Select
                        value={insuranceCompany}
                        onValueChange={setInsuranceCompany}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select insurance company…" />
                        </SelectTrigger>
                        <SelectContent>
                          {insuranceCompanies.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Insurance company name"
                        value={insuranceCompany}
                        onChange={(e) => setInsuranceCompany(e.target.value)}
                      />
                    )}
                    {insuranceCompanies.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No companies configured.{" "}
                        <a
                          href="/settings/company-partners"
                          target="_blank"
                          className="underline underline-offset-2"
                        >
                          Add in Settings
                        </a>
                        .
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="insurance_amount">Insurance Amount (₹)</Label>
                    <Input
                      id="insurance_amount"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={insuranceAmount}
                      onChange={(e) => setInsuranceAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount owed to dealer by insurance company — deducted from customer&apos;s payment.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Spares Counter Sales Description ────────────────────────────────── */}
      {isSpares && (
        <Card>
          <CardHeader>
            <CardTitle>Spares Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="spares_description">Item / Part Description</Label>
              <Input
                id="spares_description"
                placeholder="e.g. Oil Filter, Brake Pads, Clutch Kit…"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter part name or brief description of spares sold at counter.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Amount Details ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Amount Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="base_amount">Sale Amount (₹) *</Label>
              <Input
                id="base_amount"
                type="number"
                min={1}
                step="0.01"
                placeholder="0.00"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount_amount">Discount (₹)</Label>
              <Input
                id="discount_amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Tax section — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setShowTax((p) => !p)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showTax ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showTax ? "Hide tax fields" : "Add GST / TCS"}
            </button>

            {showTax && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tax_cgst">CGST (₹)</Label>
                  <Input
                    id="tax_cgst"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={taxCgst}
                    onChange={(e) => setTaxCgst(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax_sgst">SGST (₹)</Label>
                  <Input
                    id="tax_sgst"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={taxSgst}
                    onChange={(e) => setTaxSgst(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax_igst">IGST (₹)</Label>
                  <Input
                    id="tax_igst"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={taxIgst}
                    onChange={(e) => setTaxIgst(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax_tcs">TCS (₹)</Label>
                  <Input
                    id="tax_tcs"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={taxTcs}
                    onChange={(e) => setTaxTcs(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grand total + customer amount display */}
          {base > 0 && (
            <>
              <Separator />
              <div className="rounded-lg bg-muted px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Grand Total</span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatINR(grandTotal)}
                  </span>
                </div>
                {(finAmt > 0 || insAmt > 0) && (
                  <>
                    {finAmt > 0 && (
                      <div className="flex items-center justify-between text-sm text-blue-700">
                        <span>— Finance Co. Pays</span>
                        <span className="tabular-nums">({formatINR(finAmt)})</span>
                      </div>
                    )}
                    {insAmt > 0 && (
                      <div className="flex items-center justify-between text-sm text-emerald-700">
                        <span>— Insurance Co. Owes</span>
                        <span className="tabular-nums">({formatINR(insAmt)})</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-sm">Customer Pays</span>
                      <span className="text-lg tabular-nums text-orange-700">
                        {formatINR(customerAmount)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Payment Details ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Payment Mode *</Label>
              <Select
                value={paymentMode}
                onValueChange={(v) => {
                  setPaymentMode(v);
                  if (v !== "cash") setCashbookId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment mode…" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {paymentMode && paymentMode !== "cash" && paymentMode !== "credit" && (
              <div className="space-y-1.5">
                <Label htmlFor="payment_ref">
                  {paymentMode === "cheque"
                    ? "Cheque Number *"
                    : paymentMode === "upi"
                    ? "UPI Transaction ID *"
                    : paymentMode === "finance"
                    ? "Finance Ref / Loan No. *"
                    : "Reference Number *"}
                </Label>
                <Input
                  id="payment_ref"
                  placeholder="Enter reference…"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Required for non-cash payments.</p>
              </div>
            )}

            {paymentMode === "credit" && (
              <div className="col-span-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
                ℹ Credit sale — no cash collected now. This will appear in the Credit Transactions report for later settlement.
              </div>
            )}
          </div>

          {/* Cash-specific: cashbook selector (mandatory) */}
          {paymentMode === "cash" && (
            <div className="space-y-3">
              {cashbooks.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Cash Received In *</Label>
                  <Select value={cashbookId} onValueChange={setCashbookId}>
                    <SelectTrigger className="max-w-sm">
                      <SelectValue placeholder="Select cashbook…" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashbooks.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id}>
                          {cb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cash will be posted to this cashbook. The cashbook day must be
                    open for the selected invoice date.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <strong>No active cash cashbook found</strong> for this branch.
                  Please configure a cashbook in the Cashbooks section before
                  accepting cash payments.
                </div>
              )}

              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded px-3 py-2">
                ⚠ Cash payment — system will check Section 269ST limit (₹2,00,000 per
                customer per financial year).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Notes ────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Any additional notes or remarks…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full" size="lg">
        {isPending ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Receipt className="mr-2 h-5 w-5" />
        )}
        {isPending
          ? "Creating Sales Receipt…"
          : `Create Sales Receipt${grandTotal > 0 ? ` — ${formatINR(customerAmount > 0 && (finAmt > 0 || insAmt > 0) ? customerAmount : grandTotal)} collected` : ""}`}
      </Button>
    </form>
  );
}
