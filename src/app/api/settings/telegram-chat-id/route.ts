/**
 * POST /api/settings/telegram-chat-id
 * Save telegram_chat_id for a single user (admin only, session auth).
 * Body: { user_id: string, telegram_chat_id: string | null }
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { user_id, telegram_chat_id } = body;

  if (!user_id) {
    return Response.json({ error: "user_id required" }, { status: 400 });
  }

  // telegram_chat_id must be numeric string or null/empty (Telegram chat IDs are integers)
  const cleanChatId = telegram_chat_id?.toString().trim() || null;
  if (cleanChatId && !/^-?\d+$/.test(cleanChatId)) {
    return Response.json(
      { error: "telegram_chat_id must be a numeric value. Get it from @userinfobot on Telegram." },
      { status: 400 }
    );
  }

  // Guard against saving the bot's own ID as a user's chat_id.
  // The bot token format is "<bot_id>:<secret>" — if the user accidentally pastes
  // the numeric prefix of the token, messages would fail silently (bots can't DM themselves).
  if (cleanChatId) {
    // Fetch the target user's company to compare against the bot token for that company.
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    if (targetProfile) {
      // Check all bot tokens in company_configs and reject if the numeric prefix matches
      const { data: botConfigs } = await supabase
        .from("company_configs")
        .select("config_value")
        .eq("config_key", "telegram_bot_token");

      const isBotId = (botConfigs || []).some((c: { config_value: unknown }) => {
        const token = typeof c.config_value === "string" ? c.config_value : "";
        const botIdPrefix = token.split(":")[0];
        return botIdPrefix && botIdPrefix === cleanChatId;
      });

      if (isBotId) {
        return Response.json(
          {
            error:
              "This is the BOT's own ID, not a user chat ID. The user must message @userinfobot on Telegram to get their personal chat ID (a different number from the bot token).",
          },
          { status: 400 }
        );
      }
    }
  }

  // Prevent two users from sharing the same chat_id (would misroute OTPs)
  if (cleanChatId) {
    const { data: existing } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .eq("telegram_chat_id", cleanChatId)
      .neq("id", user_id)
      .maybeSingle();

    if (existing) {
      return Response.json(
        {
          error: `This Telegram chat ID is already linked to ${existing.full_name}. Each user must have a unique chat ID.`,
        },
        { status: 400 }
      );
    }
  }

  // Verify the chat id is reachable: ask Telegram via the bot of one of the
  // user's assigned companies. If Telegram returns "chat not found" we bail
  // here so the admin sees a clear message instead of OTPs silently failing.
  if (cleanChatId) {
    const { data: assignments } = await supabase
      .from("user_assignments")
      .select("company_id, group_id")
      .eq("user_id", user_id)
      .eq("is_active", true);

    const companyIds = Array.from(
      new Set((assignments || []).map((a: { company_id: string | null }) => a.company_id).filter(Boolean))
    ) as string[];

    let botToken: string | null = null;
    if (companyIds.length > 0) {
      const { data: tokens } = await supabase
        .from("company_configs")
        .select("config_value")
        .eq("config_key", "telegram_bot_token")
        .in("company_id", companyIds);
      botToken = ((tokens || [])[0]?.config_value as string) || null;
    }
    if (!botToken) {
      // Fall back to any configured bot token in the system
      const { data: anyToken } = await supabase
        .from("company_configs")
        .select("config_value")
        .eq("config_key", "telegram_bot_token")
        .limit(1)
        .maybeSingle();
      botToken = (anyToken?.config_value as string) || null;
    }

    if (botToken) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(cleanChatId)}`,
          { method: "GET" }
        );
        const json = (await res.json()) as { ok: boolean; description?: string };
        if (!json.ok) {
          const desc = json.description || "Telegram rejected the chat id";
          return Response.json(
            {
              error:
                `Telegram says "${desc}". Two things need to be true:\n` +
                `1. The number must be the user's Telegram numeric ID (open Telegram, message @userinfobot — it replies with the ID). Phone numbers are NOT chat IDs.\n` +
                `2. The user must first send /start to your company's bot at least once, otherwise the bot cannot DM them.`,
            },
            { status: 400 }
          );
        }
      } catch {
        // Network blip — don't block the save, just skip verification
      }
    }
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ telegram_chat_id: cleanChatId })
    .eq("id", user_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
