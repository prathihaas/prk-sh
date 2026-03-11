import { z } from "zod";

export const createUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().max(20).optional().or(z.literal("")),
  temporary_password: z.string().min(8, "Password must be at least 8 characters"),
  role_id: z.string().uuid("Select a role"),
  company_id: z.string().uuid("Select a company").optional().or(z.literal("")),
  branch_id: z.string().uuid("Select a branch").optional().or(z.literal("")),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  phone: z.string().max(20).optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;

export const userAssignmentSchema = z.object({
  role_id: z.string().uuid("Select a role"),
  company_id: z.string().uuid("Select a company").optional().or(z.literal("")),
  branch_id: z.string().uuid("Select a branch").optional().or(z.literal("")),
});

export type UserAssignmentFormValues = z.infer<typeof userAssignmentSchema>;
