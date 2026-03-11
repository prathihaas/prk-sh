import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierForm } from "@/components/forms/supplier-form";

export default async function NewSupplierPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PURCHASE_CREATE)) redirect("/purchases/suppliers");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Add Supplier" description="Select a company from the header first" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Add Supplier" description="Add a new vendor to the supplier master." />
      <SupplierForm companyId={companyId} currentUserId={user.id} />
    </div>
  );
}
