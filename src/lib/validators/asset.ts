import { z } from "zod";

export const assetCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export const assetSchema = z.object({
  asset_code: z.string().min(1, "Asset code is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  category_id: z.string().optional(),
  is_vehicle: z.boolean(),
  purchase_date: z.string().optional(),
  purchase_value: z.number().min(0).optional(),
  useful_life_years: z.number().int().min(1).max(99).optional(),
  salvage_value: z.number().min(0).optional(),
  branch_id: z.string().optional(),
});

export type AssetFormValues = z.infer<typeof assetSchema>;
export type AssetCategoryFormValues = z.infer<typeof assetCategorySchema>;
