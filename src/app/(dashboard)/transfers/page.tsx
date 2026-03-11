import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getBranchTransfers } from "@/lib/queries/transfers";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportButton } from "@/components/shared/export-button";
import { exportTransfers } from "@/lib/utils/excel-export";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { columns } from "./columns";

export default async function TransfersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.TRANSFER_VIEW)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transfers" description="Select a company from the header first" />
      </div>
    );
  }

  const transfers = await getBranchTransfers(companyId);
  const canCreate = permissions.has(PERMISSIONS.TRANSFER_CREATE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Transfers"
        description="Track inter-branch and inter-company transfers with Transfer Challans."
      >
        <div className="flex gap-2">
          <ExportButton
            data={transfers}
            exportFn={exportTransfers}
            fileName="transfers"
            label="Export"
          />
          {canCreate && (
            <Button asChild>
              <Link href="/transfers/new">
                <Plus className="mr-2 h-4 w-4" />
                New Transfer
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <DataTable columns={columns} data={transfers} searchKey="status" />
    </div>
  );
}
