import { z } from "zod";

/** Payment modes that require a UTR / bank reference number. */
export const UTR_REQUIRED_MODES = ["upi", "bank_transfer", "card", "finance"] as const;

/** Business categories shown in the Receipt Type dropdown. */
export const RECEIPT_TYPES = [
  { value: "new_car", label: "New Car" },
  { value: "used_car", label: "Used Car" },
  { value: "service", label: "Service" },
  { value: "bodyshop", label: "Bodyshop" },
  { value: "insurance_renewal", label: "Insurance Renewal" },
  { value: "counter_sales", label: "Counter Sales" },
] as const;

export type ReceiptType = (typeof RECEIPT_TYPES)[number]["value"];

export const receiptSchema = z.object({
  cashbook_id: z.string().min(1, "Select a cashbook"),
  date: z.string().min(1, "Date is required"),
  // Optional: link to an existing customer record (enables cash-limit tracking)
  customer_id: z.string().optional(),
  party_name: z.string().min(1, "Party name is required").max(200),
  amount: z
    .number({ error: "Must be a number" })
    .positive("Amount must be greater than zero"),
  payment_mode: z.enum(
    ["cash", "cheque", "upi", "bank_transfer", "card", "finance", "credit"],
    { error: "Select payment mode" }
  ),
  narration: z.string().min(1, "Narration is required").max(1000),
  /**
   * Bank/UPI reference number. Required for upi/bank_transfer/card/finance,
   * disallowed for cheque and cash. Cross-field rules are enforced by
   * `validateUtrForMode` below (kept off the base schema so the inferred
   * form-input type stays simple for react-hook-form).
   */
  utr_number: z.string().trim().max(64).optional(),
  /**
   * Repair Order number (from workshop DMS). Optional; multiple receipts
   * may reference the same RO. Free text up to 64 chars.
   */
  ro_number: z.string().trim().max(64).optional(),
  /** Business category — see RECEIPT_TYPES. */
  receipt_type: z
    .enum([
      "new_car",
      "used_car",
      "service",
      "bodyshop",
      "insurance_renewal",
      "counter_sales",
    ])
    .optional(),
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;

/**
 * Cross-field UTR rule. Returns null on success, or an error message.
 * Call this from the server action and from the form's submit handler.
 */
export function validateUtrForMode(
  payment_mode: ReceiptFormValues["payment_mode"],
  utr_number: string | undefined
): string | null {
  const utr = utr_number?.trim() || "";
  const required = (UTR_REQUIRED_MODES as readonly string[]).includes(payment_mode);
  if (required && utr.length < 4) {
    return "UTR / reference number is required for UPI, bank transfer, card and finance receipts";
  }
  if ((payment_mode === "cash" || payment_mode === "cheque") && utr.length > 0) {
    return "UTR is not applicable for cash or cheque receipts";
  }
  return null;
}
