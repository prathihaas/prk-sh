import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getBranchTransfer } from "@/lib/queries/transfers";
import { PageHeader } from "@/components/shared/page-header";
import { PrintTransferChallan } from "@/components/shared/print-transfer-challan";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/components/shared/currency-display";
import { TRANSFER_TYPE_LABELS, ITEM_TYPE_LABELS } from "@/lib/validators/transfer";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  dispatched: "outline",
  in_transit: "default",
  received: "default",
  cancelled: "destructive",
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const { transferId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.TRANSFER_VIEW)) redirect("/dashboard");

  let transfer;
  try {
    transfer = await getBranchTransfer(transferId);
  } catch {
    notFound();
  }

  if (!transfer) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Transfer ${transfer.challans?.[0]?.challan_number ?? transfer.id.slice(0, 8).toUpperCase()}`}
        description={`${TRANSFER_TYPE_LABELS[transfer.transfer_type] ?? transfer.transfer_type} — ${new Date(transfer.transfer_date).toLocaleDateString("en-IN")}`}
      >
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_VARIANTS[transfer.status] ?? "outline"} className="text-sm px-3 py-1">
            {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
          </Badge>
          <PrintTransferChallan
            transfer={transfer as any}
            fromCompany={transfer.from_company as any}
            fromBranch={transfer.from_branch as any}
            toCompany={transfer.to_company as any}
            toBranch={transfer.to_branch as any}
          />
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">From</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{(transfer.from_company as any)?.name}</p>
            <p className="text-sm text-muted-foreground">{(transfer.from_branch as any)?.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">To</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{(transfer.to_company as any)?.name}</p>
            <p className="text-sm text-muted-foreground">{(transfer.to_branch as any)?.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(transfer.total_value)}</p>
            <p className="text-xs text-muted-foreground">{transfer.items?.length ?? 0} item(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfer Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase">
                  <th className="py-2 text-left">#</th>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-left">Chassis / VIN</th>
                  <th className="py-2 text-left">Engine No.</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Value</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {transfer.items?.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">{idx + 1}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-xs">
                        {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                      </Badge>
                    </td>
                    <td className="py-2 font-medium">{item.description}</td>
                    <td className="py-2 font-mono text-xs">{item.vin_chassis_number ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">{item.engine_number ?? "—"}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{formatINR(item.unit_value)}</td>
                    <td className="py-2 text-right font-medium">
                      {formatINR(item.unit_value * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {transfer.narration && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Notes:</strong> {transfer.narration}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
