import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getApprovalMatrix } from "@/lib/queries/approval-matrix";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { columns } from "./columns";

export default async function ApprovalMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ request_type?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_CONFIGURE_APPROVAL))
    redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Approval Matrix"
          description="Select a company from the header"
        />
      </div>
    );
  }

  const params = await searchParams;
  const entries = await getApprovalMatrix(companyId, params.request_type);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Matrix"
        description="Configure multi-step approval workflows"
        action={{ label: "New Entry", href: "/settings/approval-matrix/new" }}
      />
      <FilterBar
        filters={[
          {
            key: "request_type",
            label: "Request Type",
            options: [
              { value: "expense", label: "Expense" },
              { value: "invoice", label: "Invoice" },
              { value: "cashbook_variance", label: "Cashbook Variance" },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={entries}
        emptyMessage="No approval steps configured"
      />
    </div>
  );
}
