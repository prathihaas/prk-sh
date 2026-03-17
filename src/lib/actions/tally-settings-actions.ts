"use server";

/**
 * Server actions for Tally Prime settings mutations.
 * Kept separate from queries/tally-export.ts so client components
 * can import only this file (not the full server-side queries module).
 */

import { createClient } from "@/lib/supabase/server";
import type { TallySettings } from "@/lib/utils/tally-xml-generator";

export async function saveTallySettings(
  companyId: string,
  settings: TallySettings
): Promise<{ error?: string }> {
  if (!companyId) return { error: "Company ID is required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id: companyId, config_key: "tally_settings", config_value: settings },
      { onConflict: "company_id,config_key" }
    );
  if (error) return { error: error.message };
  return {};
}
