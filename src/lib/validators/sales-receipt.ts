import { z } from "zod";

export const salesReceiptSchema = z.object({
  invoice_type: z.enum(
    ["automobile_sale", "tractor_agri_sale", "service", "spares_counter_sale", "other_income"],
    { error: "Select invoice type" }
  ),
  customer_id: z.string().optional(),
  customer_name: z.string().min(1, "Customer name is required").max(200),
  customer_phone: z.string().max(20).optional(),
  customer_gstin: z.string().max(15).optional(),
  invoice_date: z.string().min(1, "Invoice date is required"),
  dms_invoice_number: z.string().max(100).optional(),

  // Vehicle fields (optional)
  vehicle_model: z.string().max(200).optional(),
  vehicle_variant: z.string().max(200).optional(),
  vin_number: z.string().max(100).optional(),
  engine_number: z.string().max(100).optional(),

  // Amounts
  base_amount: z.number({ error: "Enter the sale amount" }).positive("Amount must be positive"),
  discount_amount: z.number().min(0).optional(),
  tax_cgst: z.number().min(0).optional(),
  tax_sgst: z.number().min(0).optional(),
  tax_igst: z.number().min(0).optional(),
  tax_tcs: z.number().min(0).optional(),

  // Payment (full payment at time of sale)
  payment_mode: z.enum(
    ["cash", "cheque", "upi", "bank_transfer", "card", "finance", "credit"],
    { error: "Select payment mode" }
  ),
  payment_reference: z.string().max(200).optional(),

  // Cashbook to receive cash (only relevant when payment_mode = "cash")
  cashbook_id: z.string().optional(),

  // Insurance fields (for service type)
  insurance_due: z.boolean().optional(),
  insurance_company: z.string().max(200).optional(),

  // Finance fields (for automobile / tractor sale types)
  finance_due: z.boolean().optional(),
  finance_company: z.string().max(200).optional(),
  finance_amount: z.number().min(0).optional(),

  // Insurance amount (deducted from customer's payment; insurance company owes dealer)
  insurance_amount: z.number().min(0).optional(),

  notes: z.string().max(1000).optional(),
});

export type SalesReceiptFormValues = z.infer<typeof salesReceiptSchema>;
