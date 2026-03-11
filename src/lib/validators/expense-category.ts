import { z } from "zod";

export const expenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(200),
  budget_limit: z.number({ error: "Must be a number" }).min(0, "Budget cannot be negative").optional().nullable(),
  is_active: z.boolean(),
});

export type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>;
