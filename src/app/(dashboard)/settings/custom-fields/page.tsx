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
  searchParams: Promise<{ entity_type?: string }>;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fields: any[] = [];
  try {
    fields = await getCustomFields(companyId, params.entity_type);
  } catch (err) {
    console.error("Failed to load custom fields:", err);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Custom Fields"
          description="Manage custom field definitions for your records"
          action={{ label: "New Field", href: "/settings/custom-fields/new" }}
        />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950">
          <strong>Error loading custom fields.</strong> Please refresh the page or contact support.
        </div>
      </div>
    );
  }

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
            key: "entity_type",
            label: "Entity",
            options: [
              { value: "cashbook", label: "Cashbook" },
              { value: "receipt", label: "Receipt" },
              { value: "payment", label: "Payment" },
              { value: "invoice", label: "Invoice" },
              { value: "expense", label: "Expense" },
            ],
          },
        ]}
      />
      <CustomFieldsColumns data={fields} />
    </div>
  );
}
