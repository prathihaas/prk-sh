import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCustomer } from "@/lib/queries/customers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerForm } from "@/components/forms/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CUSTOMER_UPDATE)) redirect(`/sales/customers/${customerId}`);

  let customer;
  try {
    customer = await getCustomer(customerId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit — ${customer.full_name}`}
        description={`Customer ID: ${customer.customer_code}`}
      />
      <CustomerForm
        companyId={customer.company_id}
        branchId={customer.branch_id}
        currentUserId={user.id}
        customer={customer}
      />
    </div>
  );
}
