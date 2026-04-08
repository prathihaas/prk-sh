import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCurrentFinancialYear } from "@/lib/queries/financial-years";
import { getSuppliers } from "@/lib/queries/purchases";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseInvoiceForm } from "@/components/forms/purchase-invoice-form";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PURCHASE_CREATE)) redirect("/purchases");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Purchase" description="Select a company from the header first" />
      </div>
    );
  }

  const fy = await getCurrentFinancialYear(companyId);

  const suppliers = await getSuppliers(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase Invoice"
        description="Record a vendor purchase invoice."
      />
      <PurchaseInvoiceForm
        companyId={companyId}
        branchId={branchId ?? ""}
        financialYearId={fy?.id ?? ""}
        currentUserId={user.id}
        suppliers={suppliers}
      />
    </div>
  );
}
