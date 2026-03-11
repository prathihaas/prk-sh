// Telegram OTP utility for receipt approval and day closing workflows

const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate a 6-digit numeric OTP
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get OTP expiry timestamp (5 minutes from now)
 */
export function getOtpExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiry;
}

/**
 * Send an OTP via Telegram Bot API
 */
export async function sendTelegramOtp(
  chatId: string,
  botToken: string,
  otp: string,
  context: string
): Promise<{ success: boolean; error?: string }> {
  const message =
    `🔐 *Prk.sh ERP — Approval OTP*\n\n` +
    `Action: ${context}\n` +
    `OTP: \`${otp}\`\n\n` +
    `⏱ Valid for ${OTP_EXPIRY_MINUTES} minutes. Do NOT share this code.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      return { success: false, error: json.description || "Telegram API error" };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * OTP comparison — stored as plain text with 5-min TTL + RLS protection
 */
export function otpMatches(inputOtp: string, storedOtp: string): boolean {
  return inputOtp.trim() === storedOtp.trim();
}
