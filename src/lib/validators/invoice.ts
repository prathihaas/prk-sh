import { z } from "zod";

export const invoiceSchema = z.object({
  invoice_type: z.enum(["automobile", "tractor", "service", "bank_payment", "other_income"], {
    error: "Select invoice type",
  }),
  customer_name: z.string().min(1, "Customer name is required").max(300),
  customer_gstin: z.string().max(15).optional().or(z.literal("")),
  customer_phone: z.string().max(15).optional().or(z.literal("")),
  customer_address: z.string().max(500).optional().or(z.literal("")),
  dms_invoice_number: z.string().max(100).optional().or(z.literal("")),
  invoice_date: z.string().min(1, "Invoice date is required"),
  // Automobile fields
  vehicle_model: z.string().max(200).optional().or(z.literal("")),
  vehicle_variant: z.string().max(200).optional().or(z.literal("")),
  vin_number: z.string().max(50).optional().or(z.literal("")),
  engine_number: z.string().max(50).optional().or(z.literal("")),
  // Tractor fields
  tractor_model: z.string().max(200).optional().or(z.literal("")),
  tractor_hp: z.string().max(50).optional().or(z.literal("")),
  chassis_number: z.string().max(50).optional().or(z.literal("")),
  // Service fields
  service_type: z.string().max(200).optional().or(z.literal("")),
  job_card_number: z.string().max(100).optional().or(z.literal("")),
  vehicle_reg_number: z.string().max(20).optional().or(z.literal("")),
  // Bank Payment fields
  finance_company_name: z.string().max(200).optional().or(z.literal("")),
  loan_account_ref: z.string().max(100).optional().or(z.literal("")),
  // Other Income fields
  income_category: z.string().max(200).optional().or(z.literal("")),
  income_ref_number: z.string().max(100).optional().or(z.literal("")),
  // Financial
  base_amount: z.number({ error: "Must be a number" }).min(0, "Amount cannot be negative"),
  discount_amount: z.number({ error: "Must be a number" }).min(0),
  tax_breakup: z.object({
    cgst: z.number().min(0),
    sgst: z.number().min(0),
    igst: z.number().min(0),
    cess: z.number().min(0),
  }),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export const invoicePaymentSchema = z.object({
  payment_mode: z.enum(["cash", "cheque", "upi", "bank_transfer", "card", "finance"], {
    error: "Select payment mode",
  }),
  amount: z.number({ error: "Must be a number" }).positive("Amount must be greater than zero"),
  reference_number: z.string().max(100).optional().or(z.literal("")),
  payment_date: z.string().min(1, "Payment date is required"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type InvoicePaymentFormValues = z.infer<typeof invoicePaymentSchema>;
