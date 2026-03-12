import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCustomers } from "@/lib/queries/customers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportButton } from "@/components/shared/export-button";
import { columns } from "./columns";

const CUSTOMER_EXPORT_COLUMNS = [
  { key: "customer_code", header: "Customer ID", width: 14 },
  { key: "full_name", header: "Name", width: 30 },
  { key: "phone", header: "Phone", width: 16 },
  { key: "email", header: "Email", width: 30 },
  { key: "customer_type", header: "Type", width: 14 },
  { key: "city", header: "City", width: 18 },
  { key: "state", header: "State", width: 18 },
  { key: "pincode", header: "Pincode", width: 12 },
  { key: "gstin", header: "GSTIN", width: 20 },
  { key: "pan", header: "PAN", width: 14 },
  { key: "is_active", header: "Active", width: 10 },
];

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CUSTOMER_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          description="Select a company from the header to view customers"
        />
      </div>
    );
  }

  const customers = await getCustomers(companyId, branchId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Customers"
          description="Manage your customer directory with unique Customer IDs"
          action={
            permissions.has(PERMISSIONS.CUSTOMER_CREATE)
              ? { label: "New Customer", href: "/sales/customers/new" }
              : undefined
          }
        />
        <div className="flex-shrink-0 pt-1">
          <ExportButton
            data={customers as Record<string, unknown>[]}
            columns={CUSTOMER_EXPORT_COLUMNS}
            filename={`customers_${new Date().toISOString().split("T")[0]}`}
            label="Export"
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={customers}
        emptyMessage="No customers yet. Create your first customer to get started."
      />
    </div>
  );
}
