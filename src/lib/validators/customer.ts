import { z } from "zod";

export const customerSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  customer_type: z.enum(["individual", "business"]).default("individual"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional()
    .or(z.literal("")),
  gstin: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Enter a valid GSTIN"
    )
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter a valid PAN number")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
