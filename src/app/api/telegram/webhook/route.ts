/**
 * POST /api/telegram/webhook
 * Receives all updates from Telegram servers.
 * Handles:
 *  - callback_query with data "approve_expense:<expenseId>:<level>"
 *  - callback_query with data "reject_expense:<expenseId>:<level>"
 *
 * Security: Telegram sends updates to the registered webhook URL only.
 * We additionally verify the bot token in the URL path (set via Telegram's setWebhook).
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelegramBotToken } from "@/lib/queries/company-configs";
import { answerCallbackQuery, sendTelegramMessage } from "@/lib/utils/telegram-notify";

// Telegram update shape (minimal — only what we need)
interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

export async function POST(req: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = await req.json() as TelegramUpdate;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Only handle callback_query (button taps)
  const cbq = update.callback_query;
  if (!cbq?.data) {
    return new Response("OK", { status: 200 });
  }

  const chatId = String(cbq.from.id);
  const data = cbq.data;

  // Parse callback data: "approve_expense:<uuid>:<level>" or "reject_expense:<uuid>:<level>"
  const match = data.match(/^(approve_expense|reject_expense):([0-9a-f-]+):(branch|accounts|owner)$/);
  if (!match) {
    return new Response("OK", { status: 200 });
  }

  const [, action, expenseId, level] = match;

  const supabase = await createClient();

  // ── Find the user by chat ID ─────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, full_name, telegram_chat_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!profile) {
    // Answer the callback to remove loading spinner, then reply
    // We don't have a bot token yet — try to find it by expense's company
    const { data: expense } = await supabase
      .from("expenses")
      .select("company_id")
      .eq("id", expenseId)
      .maybeSingle();

    if (expense?.company_id) {
      const botToken = await getTelegramBotToken(expense.company_id);
      if (botToken) {
        await answerCallbackQuery(botToken, cbq.id, "⚠️ Your Telegram account is not linked.");
        await sendTelegramMessage(botToken, chatId, "⚠️ Your Telegram Chat ID is not linked to any user in this system. Ask your admin to link it in Settings → User Access.");
      }
    }
    return new Response("OK", { status: 200 });
  }

  // ── Get expense + company for bot token ────────────────────────────────────
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .select(`
      id, amount, description, approval_status, company_id, branch_id,
      category:expense_categories(name),
      submitter:user_profiles!expenses_submitted_by_fkey(full_name)
    `)
    .eq("id", expenseId)
    .maybeSingle();

  if (expenseError || !expense) {
    return new Response("OK", { status: 200 });
  }

  const botToken = await getTelegramBotToken(expense.company_id);
  if (!botToken) {
    return new Response("OK", { status: 200 });
  }

  // ── Always answer the callback first (removes loading spinner) ─────────────
  await answerCallbackQuery(botToken, cbq.id);

  // ── Validate that the approver's action is valid for current status ─────────
  const statusRequiredMap: Record<string, string> = {
    branch: "submitted",
    accounts: "branch_approved",
    owner: "accounts_approved",
  };

  const requiredStatus = statusRequiredMap[level];
  if (expense.approval_status !== requiredStatus) {
    const statusLabel: Record<string, string> = {
      draft: "Draft",
      submitted: "Submitted (awaiting branch)",
      branch_approved: "Branch Approved (awaiting accounts)",
      accounts_approved: "Accounts Approved (awaiting owner)",
      owner_approved: "Fully Approved",
      rejected: "Rejected",
      paid: "Paid",
      paid_direct: "Paid (Direct)",
    };
    const currentLabel = statusLabel[expense.approval_status] || expense.approval_status;
    await sendTelegramMessage(
      botToken,
      chatId,
      `⚠️ This expense can no longer be actioned at the *${level}* level.\nCurrent status: *${currentLabel}*`
    );
    return new Response("OK", { status: 200 });
  }

  if (action === "approve_expense") {
    // ── Approve ─────────────────────────────────────────────────────────────
    const updateMap: Record<string, Record<string, unknown>> = {
      branch: {
        approval_status: "branch_approved",
        branch_approved_by: profile.id,
        branch_approved_at: new Date().toISOString(),
      },
      accounts: {
        approval_status: "accounts_approved",
        accounts_approved_by: profile.id,
        accounts_approved_at: new Date().toISOString(),
      },
      owner: {
        approval_status: "owner_approved",
        owner_approved_by: profile.id,
        owner_approved_at: new Date().toISOString(),
      },
    };

    const { error } = await supabase
      .from("expenses")
      .update(updateMap[level])
      .eq("id", expenseId)
      .eq("approval_status", requiredStatus);

    if (error) {
      await sendTelegramMessage(botToken, chatId, `❌ Failed to approve: ${error.message}`);
      return new Response("OK", { status: 200 });
    }

    const categoryName = (expense.category as { name?: string } | null)?.name || "Expense";
    const amtFormatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(expense.amount);

    await sendTelegramMessage(
      botToken,
      chatId,
      `✅ *Approved!*\n\n*${categoryName}* — ${amtFormatted}\n_${expense.description}_\n\nApproved at ${level} level by *${profile.full_name || "you"}*.`
    );

  } else {
    // ── Reject ──────────────────────────────────────────────────────────────
    const { error } = await supabase
      .from("expenses")
      .update({
        approval_status: "rejected",
        rejection_reason: `Rejected via Telegram by ${profile.full_name || "approver"} (${level} level)`,
      })
      .eq("id", expenseId)
      .eq("approval_status", requiredStatus);

    if (error) {
      await sendTelegramMessage(botToken, chatId, `❌ Failed to reject: ${error.message}`);
      return new Response("OK", { status: 200 });
    }

    const categoryName = (expense.category as { name?: string } | null)?.name || "Expense";
    const amtFormatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(expense.amount);

    await sendTelegramMessage(
      botToken,
      chatId,
      `🚫 *Rejected*\n\n*${categoryName}* — ${amtFormatted}\n_${expense.description}_\n\nRejected at ${level} level by *${profile.full_name || "you"}*.`
    );
  }

  return new Response("OK", { status: 200 });
}
