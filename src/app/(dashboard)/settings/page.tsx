import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Settings2, ListChecks, UserCog, Webhook, IndianRupee } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);

  const canConfigureApproval = permissions.has(PERMISSIONS.ADMIN_CONFIGURE_APPROVAL);
  const canManageCustomFields = permissions.has(PERMISSIONS.ADMIN_MANAGE_CUSTOM_FIELDS);
  const canManageUsers = permissions.has(PERMISSIONS.ADMIN_MANAGE_USERS);
  const canManageCompanies = permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES);

  if (!canConfigureApproval && !canManageCustomFields && !canManageUsers && !canManageCompanies) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure approval workflows, user access controls, API keys, and webhooks"
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {canConfigureApproval && (
          <Link href="/settings/approval-matrix" className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Approval Matrix</CardTitle>
                </div>
                <CardDescription>
                  Configure multi-step approval workflows for expenses, invoices,
                  and cashbook variances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Define which roles approve requests and in what order
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
        {canManageCustomFields && (
          <Link href="/settings/custom-fields" className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Custom Fields</CardTitle>
                </div>
                <CardDescription>
                  Add custom data fields to employees, expenses, invoices, and
                  transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Extend records with text, number, date, boolean, or dropdown
                  fields
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
        {canManageUsers && (
          <Link href="/settings/user-access" className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">User Access Controls</CardTitle>
                </div>
                <CardDescription>
                  Grant special permissions to specific users — backdated receipts,
                  direct expense payments, and edit access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fine-grained access beyond role-based permissions
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
        {canConfigureApproval && (
          <Link href="/settings/cash-limits" className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Cash Limit Controls</CardTitle>
                </div>
                <CardDescription>
                  Configure maximum cash transaction limits as required by Indian
                  Income Tax Act (Sections 269ST &amp; 40A(3))
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Hard-block cash receipts and expense payments that exceed legal limits
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
        {canManageCompanies && (
          <Link href="/settings/api-webhooks" className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">API & Webhooks</CardTitle>
                </div>
                <CardDescription>
                  Manage API keys for REST API access and configure outbound
                  webhooks for real-time event notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Integrate with external systems and automate workflows
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
