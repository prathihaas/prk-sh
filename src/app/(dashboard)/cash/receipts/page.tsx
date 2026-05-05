import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
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
  { key: "receipt_date", header: "Receipt Date", width: 16, format: "date" as const },
  { key: "created_at", header: "Created", width: 20, format: "date" as const },
  { key: "party_name", header: "Received From", width: 28 },
  { key: "amount", header: "Amount (INR)", width: 16, format: "currency" as const },
  { key: "payment_mode", header: "Payment Mode", width: 16 },
  { key: "receipt_type_label", header: "Receipt Type", width: 18 },
  { key: "ro_number", header: "R/O Number", width: 14 },
  { key: "utr_number", header: "UTR / Ref", width: 20 },
  { key: "narration", header: "Narration", width: 45 },
  { key: "cashbook_name", header: "Cashbook", width: 22 },
  { key: "created_by_name", header: "Processed By", width: 24 },
  { key: "status_label", header: "Status", width: 12 },
];

const RECEIPT_TYPE_LABELS: Record<string, string> = {
  new_car: "New Car",
  used_car: "Used Car",
  service: "Service",
  bodyshop: "Bodyshop",
  insurance_renewal: "Insurance Renewal",
  counter_sales: "Counter Sales",
};

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_mode?: string; status?: string; receipt_type?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  const branchId = cookieStore.get("scope_branch_id")?.value;
  // resolveCompanyScope falls back to first accessible company when no cookie is set
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );

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
    receipt_type: params.receipt_type,
  });

  const canCreate = permissions.has(PERMISSIONS.CASHBOOK_CREATE_TXN);

  // Pre-process for export: flatten nested objects and format booleans
  const exportData = (receipts as Record<string, unknown>[]).map((r) => {
    const creator = r.creator as { full_name?: string } | null;
    const cashbook = r.cashbook as { name?: string } | null;
    const day = r.day as { date?: string } | null;
    const rtype = r.receipt_type as string | null | undefined;
    return {
      ...r,
      receipt_date: day?.date || "",
      created_by_name: creator?.full_name || "",
      cashbook_name: cashbook?.name || "",
      status_label: r.is_voided ? "Voided" : "Active",
      receipt_type_label: rtype ? RECEIPT_TYPE_LABELS[rtype] || rtype : "",
    };
  });

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
            data={exportData}
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
            key: "receipt_type",
            label: "Receipt Type",
            options: [
              { value: "new_car", label: "New Car" },
              { value: "used_car", label: "Used Car" },
              { value: "service", label: "Service" },
              { value: "bodyshop", label: "Bodyshop" },
              { value: "insurance_renewal", label: "Insurance Renewal" },
              { value: "counter_sales", label: "Counter Sales" },
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
