import { z } from "zod";

export const expenseSchema = z.object({
  category_id: z.string().min(1, "Select a category"),
  expense_date: z.string().min(1, "Date is required"),
  amount: z.number({ error: "Must be a number" }).positive("Amount must be greater than zero"),
  description: z.string().min(1, "Description is required").max(2000),
  bill_reference: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

export const rejectExpenseSchema = z.object({
  rejection_reason: z.string().min(10, "Reason must be at least 10 characters").max(1000),
});

export type RejectExpenseFormValues = z.infer<typeof rejectExpenseSchema>;

export const expensePaymentSchema = z.object({
  cashbook_id: z.string().min(1, "Select a cashbook"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_mode: z.enum(
    ["cash", "cheque", "upi", "bank_transfer", "card", "finance", "credit"],
    { error: "Select payment mode" }
  ),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ExpensePaymentFormValues = z.infer<typeof expensePaymentSchema>;
