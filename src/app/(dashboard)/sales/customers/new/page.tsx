import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/forms/customer-form";

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CUSTOMER_CREATE)) redirect("/sales/customers");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New Customer"
          description="Please select a company from the header first"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Customer"
        description="Create a new customer — a unique Customer ID will be auto-assigned"
      />
      <CustomerForm
        companyId={companyId}
        branchId={branchId}
        currentUserId={user.id}
      />
    </div>
  );
}
