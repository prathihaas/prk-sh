import { z } from "zod";

export const customFieldSchema = z.object({
  table_name: z.string().min(1, "Select a table"),
  field_name: z.string().min(1, "Field name is required").max(100),
  field_type: z.string().min(1, "Select a field type"),
  field_options: z.string().optional().or(z.literal("")),
  is_required: z.boolean(),
  display_order: z.number({ error: "Required" }).int().min(0, "Must be zero or greater"),
});

export type CustomFieldFormValues = z.infer<typeof customFieldSchema>;
