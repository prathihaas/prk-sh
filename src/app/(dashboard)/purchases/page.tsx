import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getPurchaseInvoices } from "@/lib/queries/purchases";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportButton } from "@/components/shared/export-button";
import { exportPurchases } from "@/lib/utils/excel-export";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { columns } from "./columns";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PURCHASE_VIEW)) redirect("/dashboard");

  const cookieStore = await cookies();
  const branchId = cookieStore.get("scope_branch_id")?.value;
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Purchases" description="Select a company from the header first" />
      </div>
    );
  }

  const purchases = await getPurchaseInvoices(companyId, branchId);

  const canCreate = permissions.has(PERMISSIONS.PURCHASE_CREATE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Invoices"
        description="Track all vendor purchases — vehicles, parts, services, and general."
      >
        <div className="flex gap-2">
          <ExportButton
            data={purchases}
            exportFn={exportPurchases}
            fileName="purchases"
            label="Export"
          />
          {canCreate && (
            <Button asChild>
              <Link href="/purchases/new">
                <Plus className="mr-2 h-4 w-4" />
                New Purchase
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <DataTable columns={columns} data={purchases} searchKey="supplier_invoice_number" />
    </div>
  );
}
