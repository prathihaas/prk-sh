import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getFraudFlags } from "@/lib/queries/fraud-flags";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { columns } from "./columns";

export default async function FraudFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_VIEW_FRAUD_FLAGS)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Fraud Flags"
          description="Select a company from the header"
        />
      </div>
    );
  }

  const params = await searchParams;
  const flags = await getFraudFlags(companyId, {
    severity: params.severity,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud Flags"
        description="System-detected anomalies and suspicious activity flags"
      />
      <FilterBar
        filters={[
          {
            key: "severity",
            label: "Severity",
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ],
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "open", label: "Open" },
              { value: "investigating", label: "Investigating" },
              { value: "resolved", label: "Resolved" },
              { value: "false_positive", label: "False Positive" },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={flags}
        emptyMessage="No fraud flags found"
      />
    </div>
  );
}
