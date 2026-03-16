import { z } from "zod";

export const receiptSchema = z.object({
  cashbook_id: z.string().min(1, "Select a cashbook"),
  date: z.string().min(1, "Date is required"),
  // Optional: link to an existing customer record (enables cash-limit tracking)
  customer_id: z.string().uuid().optional().or(z.literal("")),
  party_name: z.string().min(1, "Party name is required").max(200),
  amount: z
    .number({ error: "Must be a number" })
    .positive("Amount must be greater than zero"),
  payment_mode: z.enum(
    ["cash", "cheque", "upi", "bank_transfer", "card", "finance"],
    { error: "Select payment mode" }
  ),
  narration: z.string().min(1, "Narration is required").max(1000),
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;
