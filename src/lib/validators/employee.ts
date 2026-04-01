import { z } from "zod";

export const employeeSchema = z.object({
  employee_code: z.string().min(1, "Employee code is required").max(50),
  full_name: z.string().min(1, "Full name is required").max(300),
  designation: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  ctc_annual: z.number({ error: "Must be a number" }).positive("CTC must be positive"),
  basic_salary: z.number({ error: "Must be a number" }).positive("Basic salary must be positive"),
  hra: z.number({ error: "Must be a number" }).min(0, "HRA cannot be negative"),
  allowances: z.number({ error: "Must be a number" }).min(0, "Allowances cannot be negative"),
  pf_applicable: z.boolean(),
  esi_applicable: z.boolean(),
  pt_applicable: z.boolean(),
  bank_name: z.string().max(200).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_ifsc: z.string().max(20).optional(),
  joining_date: z.string().min(1, "Joining date is required"),
  exit_date: z.string().optional(),
  status: z.enum(["active", "inactive", "terminated", "on_notice"], {
    error: "Select a status",
  }),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
