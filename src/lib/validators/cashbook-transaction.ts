import { z } from "zod";

export const cashbookTransactionSchema = z.object({
  txn_type: z.enum(["receipt", "payment"], {
    error: "Select transaction type",
  }),
  amount: z
    .number({ error: "Must be a number" })
    .positive("Amount must be greater than zero"),
  payment_mode: z.enum(
    ["cash", "cheque", "upi", "bank_transfer", "card", "finance", "credit"],
    { error: "Select payment mode" }
  ),
  narration: z.string().min(1, "Narration is required").max(1000),
  party_name: z.string().max(200).optional().or(z.literal("")),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  contra_cashbook_id: z.string().uuid().optional().or(z.literal("")),
});

export type CashbookTransactionFormValues = z.infer<
  typeof cashbookTransactionSchema
>;

export const voidTransactionSchema = z.object({
  void_reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(1000),
});

export type VoidTransactionFormValues = z.infer<typeof voidTransactionSchema>;
