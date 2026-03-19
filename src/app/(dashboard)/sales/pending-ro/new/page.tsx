import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { PendingRoForm } from "./pending-ro-form";

export default async function NewPendingRoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.SALES_RECEIPT_CREATE)) redirect("/sales/pending-ro");

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || "";

  if (!companyId || !branchId) redirect("/sales/pending-ro");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Add Pending R/O"
        description="Record a repair order that is closed but awaiting customer payment and delivery."
      />
      <PendingRoForm
        userId={user.id}
        companyId={companyId}
        branchId={branchId}
      />
    </div>
  );
}
