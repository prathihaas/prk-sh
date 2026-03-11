import { z } from "zod";

export const openDaySchema = z.object({
  date: z.string().min(1, "Date is required"),
});

export type OpenDayFormValues = z.infer<typeof openDaySchema>;

export const closeDaySchema = z.object({
  physical_count: z
    .number({ error: "Must be a number" })
    .min(0, "Physical count cannot be negative"),
});

export type CloseDayFormValues = z.infer<typeof closeDaySchema>;

export const reopenDaySchema = z.object({
  reopen_reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(1000),
});

export type ReopenDayFormValues = z.infer<typeof reopenDaySchema>;
