import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getSuppliers } from "@/lib/queries/purchases";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supplierColumns } from "./columns";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.PURCHASE_VIEW)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Suppliers" description="Select a company from the header first" />
      </div>
    );
  }

  const suppliers = await getSuppliers(companyId);
  const canCreate = permissions.has(PERMISSIONS.PURCHASE_CREATE);

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage vendor/supplier master data.">
        {canCreate && (
          <Button asChild>
            <Link href="/purchases/suppliers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Link>
          </Button>
        )}
      </PageHeader>

      <DataTable columns={supplierColumns} data={suppliers} searchKey="name" />
    </div>
  );
}
