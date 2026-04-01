import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { getInvoices } from "@/lib/queries/invoices";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { ExportButton } from "@/components/shared/export-button";
import { columns } from "./columns";
import { exportInvoices } from "@/lib/utils/excel-export";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.INVOICE_READ)) redirect("/dashboard");

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
        <PageHeader title="Invoices" description="Select a company from the header to view invoices" />
      </div>
    );
  }

  const params = await searchParams;
  const invoices = await getInvoices(companyId, branchId, {
    type: params.type,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Vehicle sales, tractor sales, service, bank payments and other income"
        action={
          permissions.has(PERMISSIONS.INVOICE_CREATE)
            ? { label: "New Invoice", href: "/invoices/new" }
            : undefined
        }
      />
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <FilterBar
          filters={[
            {
              key: "type",
              label: "Type",
              options: [
                { value: "automobile", label: "Vehicle Sale" },
                { value: "tractor", label: "Tractor / Agri Sale" },
                { value: "service", label: "Vehicle Service" },
                { value: "bank_payment", label: "Bank Payment" },
                { value: "other_income", label: "Other Income" },
              ],
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "pending", label: "Pending" },
                { value: "accounts_approved", label: "Accounts Approved" },
                { value: "manager_approved", label: "Manager Approved" },
                { value: "cancelled", label: "Cancelled" },
              ],
            },
          ]}
        />
        <ExportButton
          data={invoices as Record<string, unknown>[]}
          columns={[
            { key: "dms_invoice_number", header: "Invoice No", width: 18 },
            { key: "invoice_date", header: "Date", width: 16, format: "date" },
            { key: "invoice_type", header: "Type", width: 18 },
            { key: "customer_name", header: "Customer", width: 30 },
            { key: "customer_phone", header: "Phone", width: 16 },
            { key: "grand_total", header: "Grand Total (INR)", width: 18, format: "currency" },
            { key: "total_received", header: "Received (INR)", width: 18, format: "currency" },
            { key: "balance_due", header: "Balance Due (INR)", width: 18, format: "currency" },
            { key: "approval_status", header: "Status", width: 20 },
          ]}
          filename={`invoices_${new Date().toISOString().split("T")[0]}`}
        />
      </div>
      <DataTable columns={columns} data={invoices} emptyMessage="No invoices found" />
    </div>
  );
}
