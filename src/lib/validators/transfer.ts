import { z } from "zod";

export const transferItemSchema = z.object({
  item_type: z.enum(["vehicle", "spare_parts", "cash", "document", "other"]),
  description: z.string().min(1, "Description required"),
  quantity: z.number().positive("Must be > 0"),
  unit: z.string().max(20).optional().or(z.literal("")),
  unit_value: z.number().min(0).default(0),
  vin_chassis_number: z.string().max(50).optional().or(z.literal("")),
  engine_number: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const branchTransferSchema = z.object({
  transfer_type: z.enum(["inter_branch", "inter_company"]),
  to_company_id: z.string().min(1, "Select destination company"),
  to_branch_id: z.string().min(1, "Select destination branch"),
  transfer_date: z.string().min(1, "Transfer date required"),
  narration: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(transferItemSchema).min(1, "Add at least one item"),
});

export type TransferItemFormValues = z.infer<typeof transferItemSchema>;
export type BranchTransferFormValues = z.infer<typeof branchTransferSchema>;

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  inter_branch: "Inter-Branch Transfer",
  inter_company: "Inter-Company Transfer",
};

export const ITEM_TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  spare_parts: "Spare Parts",
  cash: "Cash",
  document: "Document",
  other: "Other",
};
