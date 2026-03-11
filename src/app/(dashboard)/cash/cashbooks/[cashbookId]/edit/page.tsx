import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbook } from "@/lib/queries/cashbooks";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CashbookForm } from "@/components/forms/cashbook-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function EditCashbookPage({
  params,
}: {
  params: Promise<{ cashbookId: string }>;
}) {
  const { cashbookId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_CREATE)) redirect("/dashboard");

  let cashbook;
  try {
    cashbook = await getCashbook(cashbookId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Cashbook"
        description={`Editing ${cashbook.name}`}
      />
      <CashbookForm
        companyId={cashbook.company_id}
        branchId={cashbook.branch_id}
        currentUserId={user.id}
        cashbook={cashbook}
      />
    </div>
  );
}
