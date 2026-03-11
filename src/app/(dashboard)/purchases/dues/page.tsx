import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getDuePurchases } from "@/lib/queries/purchases";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { dueColumns } from "./columns";

export default async function PurchasesDuesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PURCHASE_VIEW)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dues to Pay" description="Select a company from the header first" />
      </div>
    );
  }

  const dues = await getDuePurchases(companyId, branchId);
  const totalDue = dues.reduce((s, d) => s + (d.balance_due ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues to Pay"
        description="All outstanding purchase invoices where payment is pending."
      >
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm dark:border-red-800 dark:bg-red-950">
          <span className="text-muted-foreground">Total Outstanding: </span>
          <span className="font-bold text-red-700 dark:text-red-300">
            ₹{totalDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </PageHeader>

      <DataTable
        columns={dueColumns}
        data={dues}
        searchKey="supplier_invoice_number"
      />
    </div>
  );
}
