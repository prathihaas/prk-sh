import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getSalesReceipts } from "@/lib/queries/sales-receipts";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/components/shared/currency-display";
import { Plus, Eye, CheckCircle2 } from "lucide-react";

function formatType(t: string) {
  return {
    automobile_sale: "Automobile",
    tractor_agri_sale: "Tractor/Agri",
    service: "Service",
    other_income: "Other",
  }[t] || t;
}

export default async function SalesReceiptsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.SALES_RECEIPT_VIEW)) redirect("/dashboard");

  const canCreate = permissions.has(PERMISSIONS.SALES_RECEIPT_CREATE);

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || null;

  const receipts = companyId ? await getSalesReceipts(companyId, branchId) : [];
  const total = receipts.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.grand_total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Receipts"
        description="One-step invoice + payment records for immediate full-payment sales."
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{receipts.length} receipts</span>
          <span>Total: {formatINR(total)}</span>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/sales/sales-receipts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Sales Receipt
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {receipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No sales receipts yet</p>
              <p className="text-sm">Create a sales receipt for walk-in customers who pay in full at the time of purchase.</p>
              {canCreate && (
                <Button asChild className="mt-4">
                  <Link href="/sales/sales-receipts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Sales Receipt
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {(receipts as Record<string, unknown>[]).map((r) => (
                <div key={String(r.id)} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{String(r.customer_name)}</p>
                      <Badge variant="outline" className="text-xs">{formatType(String(r.invoice_type))}</Badge>
                      {Boolean(r.delivery_challan_number) && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          Challan Issued
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.dms_invoice_number ? `${String(r.dms_invoice_number)} • ` : ""}
                      {new Date(String(r.invoice_date)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="font-semibold text-sm">{formatINR(Number(r.grand_total))}</p>
                      <p className="text-xs text-muted-foreground">Full payment</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/invoices/${r.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
