import { z } from "zod";

export const customFieldSchema = z.object({
  entity_type: z.enum(
    ["cashbook", "receipt", "payment", "invoice", "expense"],
    { error: "Select an entity" }
  ),
  field_name: z.string().min(1, "Field name is required").max(100),
  field_label: z.string().min(1, "Display label is required").max(200),
  field_type: z.enum(["text", "number", "dropdown", "date", "boolean"], {
    error: "Select a field type",
  }),
  dropdown_options: z.string().optional().or(z.literal("")),
  is_mandatory: z.boolean(),
  display_order: z
    .number({ error: "Required" })
    .int()
    .min(0, "Must be zero or greater"),
});

export type CustomFieldFormValues = z.infer<typeof customFieldSchema>;
