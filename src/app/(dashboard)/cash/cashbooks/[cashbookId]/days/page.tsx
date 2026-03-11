import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCashbook } from "@/lib/queries/cashbooks";
import { getCashbookDays, openCashbookDay } from "@/lib/queries/cashbook-days";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";
import { OpenDayButton } from "./open-day-button";

export default async function CashbookDaysPage({
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
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  let cashbook;
  try {
    cashbook = await getCashbook(cashbookId);
  } catch {
    notFound();
  }

  const days = await getCashbookDays(cashbookId);
  const canCloseDay = permissions.has(PERMISSIONS.CASHBOOK_CLOSE_DAY);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={`${cashbook.name} — Days`}
          description="View and manage daily cashbook records"
        />
        {canCloseDay && (
          <OpenDayButton
            cashbookId={cashbookId}
            companyId={cashbook.company_id}
            branchId={cashbook.branch_id}
          />
        )}
      </div>
      <DataTable
        columns={columns}
        data={days}
        emptyMessage="No days recorded yet"
      />
    </div>
  );
}
