/**
 * Settings → Tally Prime
 * ─────────────────────
 * Lets admins configure the ledger mapping between Prk.sh cashbooks/expense
 * categories and Tally Prime ledger names.
 *
 * Config is stored in company_configs with config_key = 'tally_settings'.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  getCashbooksForMapping,
  getExpenseCategoriesForMapping,
  getTallySettings,
} from "@/lib/queries/tally-export";
import { PageHeader } from "@/components/shared/page-header";
import { TallySettingsForm } from "./tally-settings-form";

export default async function TallySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tally Prime Settings"
          description="Select a company from the header to configure Tally ledger mappings."
        />
      </div>
    );
  }

  const [cashbooks, categories, settings] = await Promise.all([
    getCashbooksForMapping(companyId).catch(() => []),
    getExpenseCategoriesForMapping(companyId).catch(() => []),
    getTallySettings(companyId).catch(() => ({ company_name: "", default_income_ledger: "Sales", default_expense_ledger: "Indirect Expenses", cashbook_ledger_map: {} as Record<string, string>, expense_category_ledger_map: {} as Record<string, string> })),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tally Prime Settings"
        description="Map your Prk.sh cashbooks and expense categories to Tally Prime ledger names."
      />
      <TallySettingsForm
        companyId={companyId}
        cashbooks={cashbooks}
        categories={categories}
        initialSettings={settings}
      />
    </div>
  );
}
