import { z } from "zod";

export const financialYearSchema = z
  .object({
    label: z.string().min(1, "Label is required").max(20),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "End date must be after start date",
    path: ["end_date"],
  });

export type FinancialYearFormValues = z.infer<typeof financialYearSchema>;
