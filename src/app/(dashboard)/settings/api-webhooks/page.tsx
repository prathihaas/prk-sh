import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ApiWebhooksManager } from "./api-webhooks-manager";

export default async function ApiWebhooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) redirect("/settings");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="API & Webhooks"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  // Load existing API keys and webhook configs
  const { data: apiKeyConfig } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "api_keys")
    .single();

  const { data: webhookConfig } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "webhook_urls")
    .single();

  let apiKeys: string[] = [];
  let webhooks: Array<{ url: string; events: string[]; secret?: string }> = [];

  try {
    if (apiKeyConfig?.config_value) {
      const val = apiKeyConfig.config_value;
      apiKeys = Array.isArray(val) ? val : JSON.parse(String(val));
    }
  } catch { apiKeys = []; }

  try {
    if (webhookConfig?.config_value) {
      const val = webhookConfig.config_value;
      webhooks = Array.isArray(val) ? val : JSON.parse(String(val));
    }
  } catch { webhooks = []; }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API & Webhooks"
        description="Manage REST API keys and configure outbound webhooks for real-time event notifications"
      />
      <ApiWebhooksManager
        companyId={companyId}
        initialApiKeys={apiKeys}
        initialWebhooks={webhooks}
      />
    </div>
  );
}
