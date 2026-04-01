import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { getExpensesWithUsers } from "@/lib/queries/expenses";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { ExportButton } from "@/components/shared/export-button";
import { columns } from "./columns";

const EXPENSE_EXPORT_COLUMNS = [
  { key: "expense_date", header: "Expense Date", width: 16, format: "date" as const },
  { key: "category_name", header: "Category", width: 22 },
  { key: "amount", header: "Amount (INR)", width: 16, format: "currency" as const },
  { key: "description", header: "Description", width: 40 },
  { key: "bill_reference", header: "Bill Ref", width: 18 },
  { key: "submitted_by_name", header: "Submitted By", width: 22 },
  { key: "approval_status", header: "Status", width: 20 },
  { key: "paid_by_name", header: "Paid By", width: 22 },
  { key: "payment_date", header: "Payment Date", width: 16, format: "date" as const },
  { key: "payment_mode", header: "Payment Mode", width: 16 },
];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.EXPENSE_SUBMIT)) redirect("/dashboard");

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
        <PageHeader title="Expenses" description="Select a company from the header" />
      </div>
    );
  }

  const params = await searchParams;
  const expenses = await getExpensesWithUsers(companyId, branchId, { status: params.status });

  // Flatten for export
  const exportData = (expenses as Array<{
    category?: { name?: string } | null;
    submitter?: { full_name?: string | null; email?: string | null } | null;
    payer?: { full_name?: string | null; email?: string | null } | null;
    [key: string]: unknown;
  }>).map((e) => ({
    ...e,
    category_name: e.category?.name || "",
    submitted_by_name: e.submitter?.full_name || e.submitter?.email || "",
    paid_by_name: e.payer?.full_name || e.payer?.email || "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Expenses"
          description="Track and manage expenses with approval workflow"
          action={
            permissions.has(PERMISSIONS.EXPENSE_SUBMIT)
              ? { label: "New Expense", href: "/expenses/new" }
              : undefined
          }
        />
        <div className="flex-shrink-0 pt-1">
          <ExportButton
            data={exportData as Record<string, unknown>[]}
            columns={EXPENSE_EXPORT_COLUMNS}
            filename={`expenses_${new Date().toISOString().split("T")[0]}`}
            label="Export"
          />
        </div>
      </div>
      <FilterBar
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "draft", label: "Draft" },
              { value: "submitted", label: "Submitted" },
              { value: "branch_approved", label: "Branch Approved" },
              { value: "accounts_approved", label: "Accounts Approved" },
              { value: "owner_approved", label: "Owner Approved" },
              { value: "paid", label: "Paid" },
              { value: "paid_direct", label: "Paid (Direct)" },
              { value: "rejected", label: "Rejected" },
            ],
          },
        ]}
      />
      <DataTable columns={columns} data={expenses} emptyMessage="No expenses found" />
    </div>
  );
}
