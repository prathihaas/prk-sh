import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbooks } from "@/lib/queries/cashbooks";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function BankAccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  // Note: branchId is intentionally ignored for bank accounts — banks are company-wide

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bank Accounts"
          description="Select a company from the header to view bank accounts"
        />
      </div>
    );
  }

  // Bank accounts are COMPANY-WIDE — all branches in the company share the same banks
  // Do NOT filter by branch (pass null explicitly)
  const bankAccounts = await getCashbooks(companyId, null, "bank");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Accounts"
        description="Company-wide bank accounts — shared across all branches"
        action={
          permissions.has(PERMISSIONS.CASHBOOK_CREATE)
            ? { label: "Add Bank Account", href: "/cash/cashbooks/new" }
            : undefined
        }
      />
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <strong>Company-wide:</strong> Bank accounts are shared across all branches of this company.
        Switching branches does not change which bank accounts you see.
        To create a bank account, use Cashbooks and select type &quot;Bank&quot;.
      </div>
      <DataTable
        columns={columns}
        data={bankAccounts}
        emptyMessage="No bank accounts found. Create a cashbook with type 'Bank' to add one."
      />
    </div>
  );
}
