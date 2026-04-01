import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveCompanyScope } from "@/lib/auth/helpers";
import { getApprovalRequests } from "@/lib/queries/approvals";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { columns } from "./columns";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const branchId = cookieStore.get("scope_branch_id")?.value;
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Approvals"
          description="Select a company from the header"
        />
      </div>
    );
  }

  const params = await searchParams;
  const requests = await getApprovalRequests(companyId, branchId, {
    status: params.status,
    type: params.type,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review and manage approval requests"
      />
      <FilterBar
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "escalated", label: "Escalated" },
            ],
          },
          {
            key: "type",
            label: "Type",
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
        data={requests}
        emptyMessage="No approval requests found"
      />
    </div>
  );
}
