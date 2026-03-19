import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import {
  getTelegramBotToken,
  getTelegramDayCloseConfig,
  getTelegramExpenseApprovers,
} from "@/lib/queries/company-configs";
import { TelegramSettingsForm } from "./telegram-settings-form";

export default async function TelegramSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_CONFIGURE_APPROVAL)) redirect("/settings");

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  if (!companyId) redirect("/settings");

  // Load all data in parallel
  const [botToken, dayCloseConfig, expenseApprovers] = await Promise.all([
    getTelegramBotToken(companyId),
    getTelegramDayCloseConfig(companyId),
    getTelegramExpenseApprovers(companyId),
  ]);

  // Load users with telegram_chat_id (for manager dropdowns)
  const { data: usersRaw } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, telegram_chat_id")
    .eq("is_active", true)
    .order("full_name");

  const users = (usersRaw || []).map((u: {
    id: string; full_name: string | null; email: string | null; telegram_chat_id: string | null
  }) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    has_telegram: !!u.telegram_chat_id,
  }));

  // Load branches
  const { data: branchesRaw } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  const branches = (branchesRaw || []).map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
  }));

  // Load cashbooks
  const { data: cashbooksRaw } = await supabase
    .from("cashbooks")
    .select("id, name, branch_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  const cashbooks = (cashbooksRaw || []).map((c: { id: string; name: string; branch_id: string | null }) => ({
    id: c.id,
    name: c.name,
    branch_id: c.branch_id,
  }));

  // Build app URL for webhook registration display
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://your-app.vercel.app";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram Bot Settings"
        description="Configure your Telegram bot for day-close OTP approvals and expense notifications"
      />
      <TelegramSettingsForm
        companyId={companyId}
        initialBotToken={botToken || ""}
        initialDayCloseConfig={dayCloseConfig}
        initialExpenseApprovers={expenseApprovers}
        users={users}
        branches={branches}
        cashbooks={cashbooks}
        webhookUrl={`${appUrl}/api/telegram/webhook`}
      />
    </div>
  );
}
