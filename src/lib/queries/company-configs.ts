"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getCompanyConfigs(
  companyId: string
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_configs")
    .select("config_key, config_value")
    .eq("company_id", companyId);

  if (error) throw error;

  const configs: Record<string, unknown> = {};
  for (const row of data || []) {
    configs[row.config_key] = row.config_value;
  }
  return configs;
}

export async function updateConfig(
  companyId: string,
  key: string,
  value: unknown
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("company_configs")
    .upsert(
      {
        company_id: companyId,
        config_key: key,
        config_value: value,
      },
      { onConflict: "company_id,config_key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
