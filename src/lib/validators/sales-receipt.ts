import { z } from "zod";

export const salesReceiptSchema = z.object({
  invoice_type: z.enum(
    ["automobile_sale", "tractor_agri_sale", "service", "other_income"],
    { error: "Select invoice type" }
  ),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  customer_name: z.string().min(1, "Customer name is required").max(200),
  customer_phone: z.string().max(20).optional().or(z.literal("")),
  customer_gstin: z.string().max(15).optional().or(z.literal("")),
  invoice_date: z.string().min(1, "Invoice date is required"),
  dms_invoice_number: z.string().max(100).optional().or(z.literal("")),

  // Vehicle fields (optional)
  vehicle_model: z.string().max(200).optional().or(z.literal("")),
  vehicle_variant: z.string().max(200).optional().or(z.literal("")),
  vin_number: z.string().max(100).optional().or(z.literal("")),
  engine_number: z.string().max(100).optional().or(z.literal("")),

  // Amounts
  base_amount: z.number({ error: "Enter the sale amount" }).positive("Amount must be positive"),
  discount_amount: z.number().min(0).optional(),
  tax_cgst: z.number().min(0).optional(),
  tax_sgst: z.number().min(0).optional(),
  tax_igst: z.number().min(0).optional(),
  tax_tcs: z.number().min(0).optional(),

  // Payment (full payment at time of sale)
  payment_mode: z.enum(
    ["cash", "cheque", "upi", "bank_transfer", "card", "finance"],
    { error: "Select payment mode" }
  ),
  payment_reference: z.string().max(200).optional().or(z.literal("")),

  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type SalesReceiptFormValues = z.infer<typeof salesReceiptSchema>;
