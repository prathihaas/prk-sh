import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getAuditLogs } from "@/lib/queries/audit-log";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { columns } from "./columns";
import { Badge } from "@/components/ui/badge";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    table_name?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_VIEW_AUDIT_LOG)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Audit Log"
          description="Select a company from the header"
        />
      </div>
    );
  }

  const params = await searchParams;
  const logs = await getAuditLogs(companyId, {
    table_name: params.table_name,
    action: params.action,
    from_date: params.from_date,
    to_date: params.to_date,
  });

  const insertCount = logs.filter((l: { action: string }) => l.action === "INSERT").length;
  const updateCount = logs.filter((l: { action: string }) => l.action === "UPDATE").length;
  const deleteCount = logs.filter((l: { action: string }) => l.action === "DELETE").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Immutable record of all data changes across the system — cannot be edited or deleted"
      />

      {/* Summary stats */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">Total Records:</span>
          <Badge variant="outline" className="tabular-nums">{logs.length}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">Inserts:</span>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 tabular-nums">{insertCount}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">Updates:</span>
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 tabular-nums">{updateCount}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">Deletes:</span>
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 tabular-nums">{deleteCount}</Badge>
        </div>
      </div>

      <FilterBar
        filters={[
          {
            key: "table_name",
            label: "Table",
            options: [
              { value: "cashbook_transactions", label: "Cashbook Transactions" },
              { value: "cashbooks", label: "Cashbooks" },
              { value: "cashbook_days", label: "Cashbook Days" },
              { value: "expenses", label: "Expenses" },
              { value: "invoices", label: "Invoices" },
              { value: "receipts", label: "Receipts" },
              { value: "user_profiles", label: "Users" },
              { value: "roles", label: "Roles" },
              { value: "approval_requests", label: "Approvals" },
            ],
          },
          {
            key: "action",
            label: "Action",
            options: [
              { value: "INSERT", label: "Insert (Created)" },
              { value: "UPDATE", label: "Update (Modified)" },
              { value: "DELETE", label: "Delete (Removed)" },
            ],
          },
        ]}
      />
      <DateRangeInputs fromDate={params.from_date} toDate={params.to_date} />
      <DataTable
        columns={columns}
        data={logs}
        emptyMessage="No audit log entries found for the selected filters"
      />
    </div>
  );
}

function DateRangeInputs({
  fromDate,
  toDate,
}: {
  fromDate?: string;
  toDate?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="from_date" className="text-xs">
          From Date
        </Label>
        <Input
          id="from_date"
          name="from_date"
          type="date"
          defaultValue={fromDate}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to_date" className="text-xs">
          To Date
        </Label>
        <Input
          id="to_date"
          name="to_date"
          type="date"
          defaultValue={toDate}
          className="w-[160px]"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Apply Filters
      </button>
      <a
        href="/audit/log"
        className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
      >
        Clear
      </a>
    </form>
  );
}
