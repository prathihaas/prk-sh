import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getReceipts } from "@/lib/queries/receipts";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { ExportButton } from "@/components/shared/export-button";
import { receiptColumns } from "./columns";

const RECEIPT_EXPORT_COLUMNS = [
  { key: "receipt_number", header: "Receipt No", width: 18 },
  { key: "created_at", header: "Date", width: 20, format: "date" as const },
  { key: "party_name", header: "Received From", width: 28 },
  { key: "amount", header: "Amount (INR)", width: 16, format: "currency" as const },
  { key: "payment_mode", header: "Payment Mode", width: 16 },
  { key: "narration", header: "Narration", width: 45 },
  { key: "is_voided", header: "Status", width: 10 },
];

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_mode?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Receipts"
          description="Select a company from the header to view receipts"
        />
      </div>
    );
  }

  const params = await searchParams;
  const receipts = await getReceipts(companyId, branchId, {
    payment_mode: params.payment_mode,
    status: params.status,
  });

  const canCreate = permissions.has(PERMISSIONS.CASHBOOK_CREATE_TXN);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Receipts"
          description="All receipts across cashbooks"
          action={
            canCreate
              ? { label: "New Receipt", href: "/cash/receipts/new", icon: HandCoins }
              : undefined
          }
        />
        <div className="flex-shrink-0 pt-1">
          <ExportButton
            data={receipts as Record<string, unknown>[]}
            columns={RECEIPT_EXPORT_COLUMNS}
            filename={`receipts_${new Date().toISOString().split("T")[0]}`}
            label="Export Receipts"
          />
        </div>
      </div>
      <FilterBar
        filters={[
          {
            key: "payment_mode",
            label: "Payment Mode",
            options: [
              { value: "cash", label: "Cash" },
              { value: "cheque", label: "Cheque" },
              { value: "upi", label: "UPI" },
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "card", label: "Card" },
              { value: "finance", label: "Finance" },
            ],
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "voided", label: "Voided" },
            ],
          },
        ]}
      />
      <DataTable
        columns={receiptColumns}
        data={receipts}
        emptyMessage="No receipts found"
      />
    </div>
  );
}
