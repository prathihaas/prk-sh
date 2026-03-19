/**
 * Telegram notification utility for expense approval workflows.
 * Sends inline-keyboard messages so approvers can act directly from Telegram.
 */

export type ExpenseApprovalLevel = "branch" | "accounts" | "owner";

const LEVEL_LABELS: Record<ExpenseApprovalLevel, string> = {
  branch: "Branch Approval",
  accounts: "Accounts Approval",
  owner: "Owner Approval",
};

interface ExpenseNotifyPayload {
  expenseId: string;
  amount: number;
  description: string;
  categoryName: string;
  expenseDate: string;
  submitterName: string;
  companyName?: string;
  branchName?: string;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Send an expense approval request to a Telegram chat with Approve / Reject inline buttons.
 * Returns { success: boolean; error?: string }.
 */
export async function sendExpenseApprovalRequest(
  payload: ExpenseNotifyPayload,
  approverLevel: ExpenseApprovalLevel,
  botToken: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  const levelLabel = LEVEL_LABELS[approverLevel];

  const dateFormatted = new Date(payload.expenseDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const contextLine = [payload.companyName, payload.branchName].filter(Boolean).join(" — ");

  const text =
    `📋 *Expense Approval Required*\n` +
    (contextLine ? `_${contextLine}_\n` : ``) +
    `\n` +
    `*Level:* ${levelLabel}\n` +
    `*Amount:* ${formatINR(payload.amount)}\n` +
    `*Category:* ${payload.categoryName}\n` +
    `*Description:* ${payload.description}\n` +
    `*Date:* ${dateFormatted}\n` +
    `*Submitted by:* ${payload.submitterName}\n` +
    `\nPlease review and take action:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ Approve",
          callback_data: `approve_expense:${payload.expenseId}:${approverLevel}`,
        },
        {
          text: "❌ Reject",
          callback_data: `reject_expense:${payload.expenseId}:${approverLevel}`,
        },
      ],
    ],
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      }),
    });

    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) {
      return { success: false, error: json.description || "Telegram API error" };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Answer a Telegram callback query (removes the loading spinner on the button).
 * Must be called within 10 seconds of receiving the callback_query update.
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || "",
        show_alert: false,
      }),
    });
  } catch {
    // Best-effort — do not throw
  }
}

/**
 * Send a plain text follow-up message to a chat.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) return { success: false, error: json.description };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
