/**
 * POST /api/telegram/save-config
 * Generic config saver for Telegram-related company_configs keys.
 * Body: { company_id, config_key, config_value }
 * Allowed keys: telegram_bot_token | telegram_day_close | telegram_expense_approvers
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// telegram_bot_token is intentionally NOT writable through the UI: a single
// shared @Prakashgroupbot token is managed centrally so admins can't break
// the integration by pasting in a different bot.
const ALLOWED_KEYS = new Set([
  "telegram_day_close",
  "telegram_expense_approvers",
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { company_id, config_key, config_value } = body;

  if (!company_id || !config_key) {
    return Response.json({ error: "company_id and config_key are required" }, { status: 400 });
  }
  if (!ALLOWED_KEYS.has(config_key)) {
    return Response.json({ error: `config_key '${config_key}' is not allowed here` }, { status: 400 });
  }

  const { error } = await supabase
    .from("company_configs")
    .upsert(
      { company_id, config_key, config_value },
      { onConflict: "company_id,config_key" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
