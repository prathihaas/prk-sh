import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  code: z
    .string()
    .min(1, "Company code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric (hyphens and underscores allowed)"),
  legal_name: z.string().max(300).optional().or(z.literal("")),
  gstin: z
    .string()
    .max(15)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val),
      { message: "Invalid GSTIN format" }
    ),
  pan: z
    .string()
    .max(10)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val),
      { message: "Invalid PAN format" }
    ),
  address_line1: z.string().max(200).optional().or(z.literal("")),
  address_line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  pincode: z.string().max(10).optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type CompanyFormValues = z.infer<typeof companySchema>;
