import { z } from "zod";

export const attendancePeriodSchema = z.object({
  month: z.number({ error: "Must be a number" }).min(1).max(12),
  year: z.number({ error: "Must be a number" }).min(2020).max(2099),
});

export type AttendancePeriodFormValues = z.infer<typeof attendancePeriodSchema>;

export const attendanceRecordSchema = z.object({
  employee_id: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["present", "absent", "half_day", "leave", "holiday", "weekly_off"], {
    error: "Select a status",
  }),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  is_late: z.boolean().default(false),
  remarks: z.string().max(500).optional(),
});

export type AttendanceRecordFormValues = z.infer<typeof attendanceRecordSchema>;
