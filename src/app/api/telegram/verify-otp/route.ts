import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { otpMatches } from "@/lib/utils/telegram-otp";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { session_id, otp } = body;

    if (!session_id || !otp) {
      return NextResponse.json({ error: "Missing session_id or otp" }, { status: 400 });
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from("otp_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid OTP session" }, { status: 400 });
    }

    // Check if already used
    if (session.used_at) {
      return NextResponse.json({ error: "OTP already used" }, { status: 400 });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Verify OTP
    if (!otpMatches(otp, session.otp_hash)) {
      return NextResponse.json({ verified: false, error: "Incorrect OTP" }, { status: 400 });
    }

    // Mark session as used
    await supabase
      .from("otp_sessions")
      .update({ used_at: new Date().toISOString() })
      .eq("id", session_id);

    return NextResponse.json({
      verified: true,
      entity_type: session.entity_type,
      entity_id: session.entity_id,
      step: session.step,
    });
  } catch (err) {
    console.error("[verify-otp] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
