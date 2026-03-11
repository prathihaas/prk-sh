import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCustomFields } from "@/lib/queries/custom-fields";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { CustomFieldsColumns } from "./custom-fields-columns";

export default async function CustomFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ table_name?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_CUSTOM_FIELDS))
    redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Custom Fields"
          description="Select a company from the header"
        />
      </div>
    );
  }

  const params = await searchParams;
  const fields = await getCustomFields(companyId, params.table_name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Fields"
        description="Manage custom field definitions for your records"
        action={{ label: "New Field", href: "/settings/custom-fields/new" }}
      />
      <FilterBar
        filters={[
          {
            key: "table_name",
            label: "Table",
            options: [
              { value: "employees", label: "Employees" },
              { value: "expenses", label: "Expenses" },
              { value: "invoices", label: "Invoices" },
              { value: "cashbook_transactions", label: "Cashbook Transactions" },
            ],
          },
        ]}
      />
      <CustomFieldsColumns data={fields} />
    </div>
  );
}
