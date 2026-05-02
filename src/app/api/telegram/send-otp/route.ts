import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

    // Get target user's Telegram chat ID via the admin client.
    // The caller is usually a cashier closing their day, and RLS on
    // user_profiles hides other users' rows from a cashier — so an
    // auth-scoped client returned no row and the route reported
    // "target user doesn't have a Telegram chat ID" even when one was set.
    // Owners have wildcard scope so the original code worked for them.
    const { data: targetUser, error: userError } = await supabaseAdmin
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
      .select("config_value")
      .eq("company_id", company_id)
      .eq("config_key", "telegram_bot_token")
      .maybeSingle();

    if (configError || !config?.config_value) {
      return NextResponse.json(
        { error: "Telegram bot not configured for this company. Go to Settings → Telegram to set up your bot token." },
        { status: 400 }
      );
    }

    const botToken = config.config_value as string;
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

    // Store OTP session in DB. Insert via the admin client because the
    // session row's user_id is the *manager* (the OTP recipient), not the
    // caller (the cashier), so RLS would block both the INSERT (in the old
    // policy) and the implicit SELECT after insert. The cashier already
    // passed auth above; we only need to materialise the row + return its id.
    const { data: session, error: sessionError } = await supabaseAdmin
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
