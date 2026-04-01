import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(200),
  gstin: z
    .string()
    .max(15)
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN")
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .max(10)
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(15).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address_line1: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_state: z.string().max(100).optional(),
  address_pincode: z.string().max(10).optional(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const purchaseItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  hsn_sac: z.string().max(20).optional(),
  quantity: z.number().positive("Must be > 0"),
  unit: z.string().max(20).optional(),
  unit_price: z.number().min(0),
  tax_percent: z.number().min(0).max(100).default(0),
  amount: z.number().min(0),
});

export const purchaseInvoiceSchema = z.object({
  supplier_id: z.string().min(1, "Select a supplier"),
  purchase_type: z.enum(["vehicle", "spare_parts", "service_amc", "general"]),
  supplier_invoice_number: z.string().min(1, "Supplier invoice number required"),
  supplier_invoice_date: z.string().min(1, "Invoice date required"),
  due_date: z.string().optional(),
  narration: z.string().max(1000).optional(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one item"),
});

export type PurchaseItemFormValues = z.infer<typeof purchaseItemSchema>;
export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

export const PURCHASE_TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle Purchase",
  spare_parts: "Spare Parts",
  service_amc: "Service / AMC",
  general: "General Purchase",
};
