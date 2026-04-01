import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { getCashbookTransfers } from "@/lib/queries/cashbook-transfers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Plus } from "lucide-react";
import { formatINR } from "@/components/shared/currency-display";
import { columns, type TransferRow } from "./columns";

export default async function CashbookTransfersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

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
        <PageHeader
          title="Cashbook Transfers"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  let transfers: TransferRow[] = [];
  try {
    transfers = await getCashbookTransfers(companyId, branchId);
  } catch (err) {
    console.error("Failed to load cashbook transfers:", err);
  }

  const canCreate = permissions.has(PERMISSIONS.CASHBOOK_TRANSFER_CREATE);

  const summary = (["pending", "approved", "rejected"] as const).map((s) => ({
    status: s,
    count: transfers.filter((t) => t.status === s).length,
    total: transfers.filter((t) => t.status === s).reduce((sum, t) => sum + Number(t.amount), 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Cashbook Transfers"
          description="Internal money transfers between cashbooks — requires accountant approval before funds move"
        />
        {canCreate && (
          <Button asChild className="flex-shrink-0">
            <Link href="/cash/cashbook-transfers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Transfer
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map(({ status, count, total }) => (
          <div
            key={status}
            className="rounded-lg border bg-card p-4 flex items-center gap-3"
          >
            <ArrowRightLeft
              className={`h-5 w-5 flex-shrink-0 ${
                status === "pending"
                  ? "text-amber-500"
                  : status === "approved"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            />
            <div>
              <p className="text-xs text-muted-foreground capitalize">{status}</p>
              <p className="font-semibold tabular-nums">{formatINR(total)}</p>
              <p className="text-xs text-muted-foreground">
                {count} transfer{count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={transfers}
        emptyMessage="No cashbook transfers found"
      />
    </div>
  );
}
