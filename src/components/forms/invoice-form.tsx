"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { invoiceSchema, type InvoiceFormValues } from "@/lib/validators/invoice";
import { createInvoice, updateInvoice } from "@/lib/queries/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatINR } from "@/components/shared/currency-display";
import {
  CustomerPickerWithCreate,
  type CustomerOption,
} from "@/components/shared/customer-picker";

interface InvoiceFormProps {
  companyId: string;
  branchId: string;
  currentUserId: string;
  financialYearId: string;
  customers: CustomerOption[];
  invoice?: Record<string, unknown>;
}

/** When editing, derive base_amount from whichever per-type amount column has a value */
function deriveBaseAmount(inv: Record<string, unknown>): number {
  return (
    Number(inv.vehicle_sale_value) ||
    Number(inv.machine_value) ||
    Number(inv.labour_amount) ||
    Number(inv.other_charges) ||
    0
  );
}

export function InvoiceForm({
  companyId,
  branchId,
  currentUserId,
  financialYearId,
  customers,
  invoice,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!invoice;

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_type: (invoice?.invoice_type as "automobile_sale" | "tractor_agri_sale" | "service" | "bank_payment" | "other_income") || "automobile_sale",
      customer_id: (invoice?.customer_id as string) || "",
      customer_name: (invoice?.customer_name as string) || "",
      customer_gstin: (invoice?.customer_gstin as string) || "",
      customer_phone: (invoice?.customer_phone as string) || "",
      dms_invoice_number: (invoice?.dms_invoice_number as string) || "",
      invoice_date: (invoice?.invoice_date as string) || new Date().toISOString().split("T")[0],
      finance_company_name: (invoice?.finance_company_name as string) || "",
      loan_account_ref: (invoice?.loan_account_ref as string) || "",
      income_category: (invoice?.income_category as string) || "",
      income_ref_number: (invoice?.income_ref_number as string) || "",
      base_amount: invoice ? deriveBaseAmount(invoice) : 0,
      discount_amount: (invoice?.discount_amount as number) ?? 0,
      tax_breakup: (invoice?.tax_breakup as { cgst: number; sgst: number; igst: number; cess: number }) || { cgst: 0, sgst: 0, igst: 0, cess: 0 },
      notes: (invoice?.notes as string) || "",
    },
  });

  const invoiceType = useWatch({ control: form.control, name: "invoice_type" });
  const customerId = useWatch({ control: form.control, name: "customer_id" });
  const baseAmount = useWatch({ control: form.control, name: "base_amount" }) || 0;
  const discountAmount = useWatch({ control: form.control, name: "discount_amount" }) || 0;
  const taxBreakup = useWatch({ control: form.control, name: "tax_breakup" });
  const taxTotal = (taxBreakup?.cgst || 0) + (taxBreakup?.sgst || 0) + (taxBreakup?.igst || 0) + (taxBreakup?.cess || 0);
  const grandTotal = baseAmount - discountAmount + taxTotal;

  function handleCustomerSelect(customer: CustomerOption | null) {
    if (customer) {
      form.setValue("customer_id", customer.id);
      form.setValue("customer_name", customer.full_name);
      form.setValue("customer_phone", customer.phone ?? "");
      form.setValue("customer_gstin", customer.gstin ?? "");
    } else {
      form.setValue("customer_id", "");
    }
  }

  async function onSubmit(values: InvoiceFormValues) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateInvoice(invoice!.id as string, values)
        : await createInvoice({
            ...values,
            company_id: companyId,
            branch_id: branchId,
            created_by: currentUserId,
            financial_year_id: financialYearId,
          });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? "Invoice updated" : "Invoice created");
        router.push("/invoices");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Invoice" : "Create Invoice"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update invoice details" : "Record a new invoice"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Invoice Type & Date */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField control={form.control} name="invoice_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="automobile_sale">Vehicle Sale</SelectItem>
                      <SelectItem value="tractor_agri_sale">Tractor / Agri Sale</SelectItem>
                      <SelectItem value="service">Vehicle Service</SelectItem>
                      <SelectItem value="bank_payment">Bank Payment (Finance)</SelectItem>
                      <SelectItem value="other_income">Other Income</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="invoice_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dms_invoice_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>DMS Invoice #</FormLabel>
                  <FormControl><Input placeholder="DMS-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            {/* Customer Info */}
            <div>
              <h3 className="text-lg font-medium mb-4">
                {invoiceType === "bank_payment" ? "Finance Company / Bank Details" : "Customer Information"}
              </h3>

              {invoiceType !== "bank_payment" && (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-1.5">Select Customer</p>
                  <CustomerPickerWithCreate
                    customers={customers}
                    companyId={companyId}
                    currentUserId={currentUserId}
                    value={customerId || undefined}
                    onSelect={handleCustomerSelect}
                    placeholder="Search customers or create new..."
                  />
                  {customerId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Fields below are auto-filled from the selected customer — you can still edit them.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="customer_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{invoiceType === "bank_payment" ? "Account Holder / Buyer Name *" : "Customer Name *"}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="customer_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="customer_gstin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl><Input placeholder="22AAAAA0000A1Z5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {invoiceType === "bank_payment" && (
              <div>
                <h3 className="text-lg font-medium mb-4">Finance / Bank Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="finance_company_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Finance Company / Bank Name</FormLabel>
                      <FormControl><Input placeholder="e.g. HDFC Bank, Kotak Mahindra" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="loan_account_ref" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Account / Reference No</FormLabel>
                      <FormControl><Input placeholder="Loan account or disbursement ref" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            )}

            {invoiceType === "other_income" && (
              <div>
                <h3 className="text-lg font-medium mb-4">Income Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="income_category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Income Category</FormLabel>
                      <FormControl><Input placeholder="e.g. Accessories, Interest, Commission" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="income_ref_number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl><Input placeholder="Internal reference or document no" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            )}

            <Separator />

            {/* Financial */}
            <div>
              <h3 className="text-lg font-medium mb-4">Financial Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="base_amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {invoiceType === "automobile_sale" ? "Vehicle Sale Value *" :
                       invoiceType === "tractor_agri_sale" ? "Machine Value *" :
                       invoiceType === "service" ? "Labour Amount *" :
                       "Amount *"}
                    </FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="discount_amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid gap-4 sm:grid-cols-4 mt-4">
                <FormField control={form.control} name="tax_breakup.cgst" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CGST</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tax_breakup.sgst" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SGST</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tax_breakup.igst" render={({ field }) => (
                  <FormItem>
                    <FormLabel>IGST</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tax_breakup.cess" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cess</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium">Grand Total</span>
                <span className="text-2xl font-bold">{formatINR(grandTotal)}</span>
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Saving..." : "Creating..."}</>
                ) : isEditing ? "Save Changes" : "Create Invoice"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/invoices")}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
