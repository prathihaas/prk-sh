import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOtp, getOtpExpiry, sendTelegramOtp } from "@/lib/utils/telegram-otp";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { entity_type, entity_id, step, target_user_id, company_id } = body;

    if (!entity_type || !entity_id || !step || !target_user_id || !company_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get target user's Telegram chat ID
    const { data: targetUser, error: userError } = await supabase
      .from("user_profiles")
      .select("telegram_chat_id, full_name")
      .eq("id", target_user_id)
      .single();

    if (userError || !targetUser?.telegram_chat_id) {
      return NextResponse.json(
        { error: "Target user does not have a Telegram chat ID configured. Go to Settings → Users to set it." },
        { status: 400 }
      );
    }

    // Get company's Telegram bot token from company_configs
    const { data: config, error: configError } = await supabase
      .from("company_configs")
      .select("config")
      .eq("company_id", company_id)
      .single();

    if (configError || !(config?.config as Record<string, string>)?.telegram_bot_token) {
      return NextResponse.json(
        { error: "Telegram bot not configured for this company. Go to Settings → Telegram Configuration." },
        { status: 400 }
      );
    }

    const botToken = (config.config as Record<string, string>).telegram_bot_token;
    const otp = generateOtp();
    const expiresAt = getOtpExpiry();

    const stepLabel = step.charAt(0).toUpperCase() + step.slice(1);
    const entityLabel =
      entity_type === "receipt" ? "Receipt" :
      entity_type === "delivery_challan" ? "Delivery Challan" :
      "Day Closing";
    const contextLabel = `${entityLabel} — ${stepLabel} Approval`;

    // Send OTP via Telegram
    const telegramResult = await sendTelegramOtp(
      targetUser.telegram_chat_id,
      botToken,
      otp,
      contextLabel
    );

    if (!telegramResult.success) {
      return NextResponse.json(
        { error: `Failed to send Telegram OTP: ${telegramResult.error}` },
        { status: 500 }
      );
    }

    // Store OTP session in DB (plain text; protected by 5-min TTL + RLS)
    const { data: session, error: sessionError } = await supabase
      .from("otp_sessions")
      .insert({
        entity_type,
        entity_id,
        step,
        otp_hash: otp,
        user_id: target_user_id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, expires_at")
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session_id: session.id,
      expires_at: session.expires_at,
      sent_to: targetUser.full_name || target_user_id,
    });
  } catch (err) {
    console.error("[send-otp] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
