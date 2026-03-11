import { z } from "zod";

export const cashbookSchema = z.object({
  name: z.string().min(1, "Cashbook name is required").max(200),
  type: z.enum(["main", "petty", "bank"], {
    error: "Select a cashbook type",
  }),
  opening_balance: z
    .number({ error: "Must be a number" })
    .min(0, "Opening balance cannot be negative"),
  is_active: z.boolean(),
});

export type CashbookFormValues = z.infer<typeof cashbookSchema>;
