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
  searchParams: Promise<{ entity_type?: string }>;
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

  let entries: Awaited<ReturnType<typeof getApprovalMatrix>> = [];
  try {
    entries = await getApprovalMatrix(companyId, params.entity_type);
  } catch (err) {
    console.error("Failed to load approval matrix:", err);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Approval Matrix"
          description="Configure multi-step approval workflows"
        />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950">
          <strong>Error loading approval matrix.</strong> Please refresh the page or contact support.
        </div>
      </div>
    );
  }

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
            key: "entity_type",
            label: "Request Type",
            options: [
              { value: "expense", label: "Expense" },
              { value: "invoice", label: "Invoice" },
              { value: "variance_approval", label: "Cashbook Variance" },
              { value: "receipt", label: "Receipt" },
              { value: "void_transaction", label: "Void Transaction" },
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
