import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CashbookForm } from "@/components/forms/cashbook-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function NewCashbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_CREATE)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId || !branchId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Create Cashbook"
          description="Please select both a company and a branch from the header first"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Cashbook"
        description="Add a new cashbook for this branch"
      />
      <CashbookForm
        companyId={companyId}
        branchId={branchId}
        currentUserId={user.id}
      />
    </div>
  );
}
