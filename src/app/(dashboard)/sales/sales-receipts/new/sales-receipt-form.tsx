"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Receipt,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  BadgeDollarSign,
  Car,
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
import { createSalesReceipt } from "@/lib/queries/sales-receipts";

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceVehicleOption {
  id: string;
  label: string;       // "Make Model Variant"
  vin_number: string;
  engine_number: string;
  status: string;
}

interface SalesReceiptFormProps {
  userId: string;
  companyId: string;
  branchId: string;
  financialYearId: string;
  customers: CustomerOption[];
  cashbooks: { id: string; name: string }[];
  serviceVehicles: ServiceVehicleOption[];
  insuranceCompanies: string[];
  financeCompanies: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INVOICE_TYPES = [
  { value: "automobile_sale", label: "Automobile Sale (Car / SUV)" },
  { value: "tractor_agri_sale", label: "Tractor / Agri Equipment Sale" },
  { value: "service", label: "Vehicle Service" },
  { value: "other_income", label: "Other Income" },
] as const;

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer / NEFT / RTGS" },
  { value: "card", label: "Debit / Credit Card" },
  { value: "finance", label: "Finance / Loan" },
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
  serviceVehicles,
  insuranceCompanies,
  financeCompanies,
}: SalesReceiptFormProps) {
  const router = useRouter();
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

  // ── Service vehicle (from vehicle register) ──────────────────────────────
  const [selectedServiceVehicleId, setSelectedServiceVehicleId] = useState<string>("");

  // ── Insurance (service type only) ────────────────────────────────────────
  const [insuranceDue, setInsuranceDue] = useState(false);
  const [insuranceCompany, setInsuranceCompany] = useState<string>("");

  // ── Finance (vehicle sale types only) ────────────────────────────────────
  const [financeDue, setFinanceDue] = useState(false);
  const [financeCompany, setFinanceCompany] = useState<string>("");
  const [financeAmount, setFinanceAmount] = useState("");

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
  const isVehicleType =
    invoiceType === "automobile_sale" || invoiceType === "tractor_agri_sale";
  const isServiceType = invoiceType === "service";

  // ── Grand total calculation ───────────────────────────────────────────────
  const base = parseFloat(baseAmount) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const cgst = parseFloat(taxCgst) || 0;
  const sgst = parseFloat(taxSgst) || 0;
  const igst = parseFloat(taxIgst) || 0;
  const tcs = parseFloat(taxTcs) || 0;
  const grandTotal = base - discount + cgst + sgst + igst + tcs;

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

  function handleServiceVehicleSelect(vehicleId: string) {
    setSelectedServiceVehicleId(vehicleId);
    if (!vehicleId || vehicleId === "none") return;
    const v = serviceVehicles.find((sv) => sv.id === vehicleId);
    if (v) {
      setVehicleModel(v.label);
      setVinNumber(v.vin_number);
      setEngineNumber(v.engine_number);
    }
  }

  function handleInvoiceTypeChange(val: string) {
    setInvoiceType(val);
    // Reset type-specific fields when type changes
    setInsuranceDue(false);
    setInsuranceCompany("");
    setFinanceDue(false);
    setFinanceCompany("");
    setFinanceAmount("");
    setSelectedServiceVehicleId("");
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
    if (paymentMode !== "cash" && !paymentReference.trim()) {
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
      const result = await createSalesReceipt({
        invoice_type: invoiceType as
          | "automobile_sale"
          | "tractor_agri_sale"
          | "service"
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
          | "finance",
        payment_reference: paymentReference || undefined,
        cashbook_id: cashbookId || undefined,
        insurance_due: insuranceDue || undefined,
        insurance_company: insuranceDue ? insuranceCompany : undefined,
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

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sales receipt created successfully.");
        router.push(`/invoices/${result.invoiceId}`);
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
                  placeholder={
                    invoiceType === "tractor_agri_sale"
                      ? "e.g. Mahindra 575 DI"
                      : "e.g. Maruti Brezza"
                  }
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
            {/* Vehicle register picker */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Car className="h-4 w-4 text-muted-foreground" />
                Link to Vehicle Register
                <span className="font-normal text-xs text-muted-foreground">
                  (optional — auto-fills fields below)
                </span>
              </Label>
              {serviceVehicles.length > 0 ? (
                <Select
                  value={selectedServiceVehicleId}
                  onValueChange={handleServiceVehicleSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle from register…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None (type manually) —</SelectItem>
                    {serviceVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                        {v.vin_number ? ` · ${v.vin_number.slice(-8)}` : ""}
                        {v.status ? ` [${v.status}]` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No vehicles in the register yet. Type vehicle details manually below.
                </p>
              )}
              {selectedServiceVehicleId && selectedServiceVehicleId !== "none" && (
                <p className="text-xs text-green-600">
                  ✓ Vehicle selected — details auto-filled below
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="svc_vehicle_model">Vehicle Model / Description</Label>
                <Input
                  id="svc_vehicle_model"
                  placeholder="e.g. Maruti Swift, Mahindra Thar"
                  value={vehicleModel}
                  onChange={(e) => {
                    setVehicleModel(e.target.value);
                    setSelectedServiceVehicleId("");
                  }}
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
                  onChange={(e) => {
                    setVinNumber(e.target.value.toUpperCase());
                    setSelectedServiceVehicleId("");
                  }}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_engine">Engine Number</Label>
                <Input
                  id="svc_engine"
                  placeholder="Engine serial number"
                  value={engineNumber}
                  onChange={(e) => {
                    setEngineNumber(e.target.value.toUpperCase());
                    setSelectedServiceVehicleId("");
                  }}
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
                <div className="ml-6 space-y-1.5">
                  <Label>Insurance Company *</Label>
                  {insuranceCompanies.length > 0 ? (
                    <Select
                      value={insuranceCompany}
                      onValueChange={setInsuranceCompany}
                    >
                      <SelectTrigger className="max-w-sm">
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
                      className="max-w-sm"
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
              )}
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

          {/* Grand total display */}
          {base > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                <span className="text-sm font-medium">Grand Total</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatINR(grandTotal)}
                </span>
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

            {paymentMode && paymentMode !== "cash" && (
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
          : `Create Sales Receipt${grandTotal > 0 ? ` — ${formatINR(grandTotal)}` : ""}`}
      </Button>
    </form>
  );
}
