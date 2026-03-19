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

  const { error } = await supabase
    .from("user_profiles")
    .update({ telegram_chat_id: cleanChatId })
    .eq("id", user_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
