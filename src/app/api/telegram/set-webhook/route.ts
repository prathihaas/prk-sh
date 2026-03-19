/**
 * POST /api/telegram/set-webhook
 * Registers the webhook URL with the Telegram Bot API for a given company's bot.
 * Body: { company_id }
 * The webhook URL will be: <NEXT_PUBLIC_APP_URL>/api/telegram/webhook
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelegramBotToken } from "@/lib/queries/company-configs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { company_id?: string };
  const { company_id } = body;

  if (!company_id) {
    return Response.json({ error: "company_id is required" }, { status: 400 });
  }

  const botToken = await getTelegramBotToken(company_id);
  if (!botToken) {
    return Response.json({ error: "No bot token configured. Save your bot token first." }, { status: 400 });
  }

  // Determine the app URL
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!appUrl) {
    return Response.json(
      { error: "NEXT_PUBLIC_APP_URL is not set. Set it in your environment variables." },
      { status: 500 }
    );
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const json = await res.json() as { ok: boolean; description?: string; result?: unknown };

    if (!json.ok) {
      return Response.json(
        { error: json.description || "Telegram API error while setting webhook" },
        { status: 400 }
      );
    }

    return Response.json({ success: true, webhookUrl });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
