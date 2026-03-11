import { z } from "zod";

export const payrollRunSchema = z.object({
  month: z.number({ error: "Must be a number" }).min(1).max(12),
  year: z.number({ error: "Must be a number" }).min(2020).max(2099),
});
export type PayrollRunFormValues = z.infer<typeof payrollRunSchema>;

export const payrollProcessSchema = z.object({
  total_working_days: z
    .number({ error: "Must be a number" })
    .min(1, "At least 1 working day")
    .max(31),
});
export type PayrollProcessFormValues = z.infer<typeof payrollProcessSchema>;

export const payrollReopenSchema = z.object({
  reopen_reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(1000),
});
export type PayrollReopenFormValues = z.infer<typeof payrollReopenSchema>;
