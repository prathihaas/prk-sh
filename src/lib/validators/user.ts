import { z } from "zod";

// Zod v4 compatible schema: .or() was removed in v4, use z.union() instead.
// UUID validation on role_id and company_id is intentionally relaxed to
// z.string().min(1) / z.string() because:
//  - Seed-data roles use non-v4 UUIDs (e.g. 10000000-0000-0000-0000-000000000001)
//    which Zod v4 rejects with strict uuid() validation.
//  - company_id / branch_id can legitimately be "" (group-wide / all-branches scope).
// The DB enforces referential integrity at insert time.

export const createUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().max(20).optional(),
  temporary_password: z.string().min(8, "Password must be at least 8 characters"),
  role_id: z.string().min(1, "Select a role"),
  company_id: z.string().optional(),
  branch_id: z.string().optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  phone: z.string().max(20).optional(),
  is_active: z.boolean(),
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;

export const userAssignmentSchema = z.object({
  role_id: z.string().min(1, "Select a role"),
  company_id: z.string().optional(),
  branch_id: z.string().optional(),
});

export type UserAssignmentFormValues = z.infer<typeof userAssignmentSchema>;
