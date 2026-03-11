import { z } from "zod";

export const leaveBalanceSchema = z.object({
  leave_type: z.enum(["casual", "sick", "earned", "maternity", "paternity", "unpaid"], {
    error: "Select leave type",
  }),
  total_days: z.number({ error: "Must be a number" }).min(0, "Cannot be negative"),
  used_days: z.number({ error: "Must be a number" }).min(0, "Cannot be negative"),
});

export type LeaveBalanceFormValues = z.infer<typeof leaveBalanceSchema>;
