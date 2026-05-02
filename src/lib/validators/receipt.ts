import { z } from "zod";

/** Payment modes that require a UTR / bank reference number. */
export const UTR_REQUIRED_MODES = ["upi", "bank_transfer", "card", "finance"] as const;

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
