import { z } from "zod";

export const approvalMatrixSchema = z.object({
  request_type: z.string().min(1, "Select a request type"),
  step_order: z.number({ error: "Required" }).int().positive("Must be a positive integer"),
  approver_role_id: z.string().min(1, "Select a role"),
  is_active: z.boolean(),
});

export type ApprovalMatrixFormValues = z.infer<typeof approvalMatrixSchema>;
