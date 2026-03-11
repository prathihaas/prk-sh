import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(200),
  code: z
    .string()
    .min(1, "Branch code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric"),
  address_line1: z.string().max(200).optional().or(z.literal("")),
  address_line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  pincode: z.string().max(10).optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchSchema>;
