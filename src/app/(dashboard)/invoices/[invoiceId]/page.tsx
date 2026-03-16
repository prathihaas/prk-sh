import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getInvoice } from "@/lib/queries/invoices";
import { getInvoicePayments } from "@/lib/queries/invoice-payments";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeliveryChallanSection } from "./delivery-challan-section";
import { PrintSalesReceipt } from "@/components/shared/print-sales-receipt";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.INVOICE_READ)) redirect("/dashboard");

  let invoice;
  try {
    invoice = await getInvoice(invoiceId);
  } catch {
    notFound();
  }

  const [payments, companyResult, branchResult] = await Promise.all([
    getInvoicePayments(invoiceId),
    supabase
      .from("companies")
      .select("name, gst_number, address, logo_url")
      .eq("id", invoice.company_id)
      .single(),
    supabase
      .from("branches")
      .select("name, address, phone")
      .eq("id", invoice.branch_id)
      .single(),
  ]);
  const company = companyResult.data ?? null;
  const branch = branchResult.data ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title={`Invoice ${invoice.dms_invoice_number || invoiceId.slice(0, 8)}`} />

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent><StatusBadge status={invoice.approval_status} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Grand Total</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold tabular-nums">{formatINR(invoice.grand_total)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Balance Due</CardTitle></CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold tabular-nums ${invoice.balance_due > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatINR(invoice.balance_due)}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><StatusBadge status={invoice.invoice_type} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Base Amount</span><span className="tabular-nums">{formatINR(invoice.base_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">{formatINR(invoice.discount_amount)}</span></div>
            {invoice.tax_breakup && (
              <>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="tabular-nums">{formatINR(invoice.tax_breakup.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="tabular-nums">{formatINR(invoice.tax_breakup.sgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="tabular-nums">{formatINR(invoice.tax_breakup.igst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cess</span><span className="tabular-nums">{formatINR(invoice.tax_breakup.cess)}</span></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{invoice.customer_name}</span></div>
            {invoice.customer_phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{invoice.customer_phone}</span></div>}
            {invoice.customer_gstin && <div className="flex justify-between"><span className="text-muted-foreground">GSTIN</span><span className="font-mono text-sm">{invoice.customer_gstin}</span></div>}
            {invoice.customer_address && <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="text-right max-w-[200px]">{invoice.customer_address}</span></div>}
          </CardContent>
        </Card>
      </div>

      {/* Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payments ({payments.length})</CardTitle>
          {invoice.balance_due > 0 && permissions.has(PERMISSIONS.INVOICE_CREATE) && (
            <Button asChild size="sm"><Link href={`/invoices/${invoiceId}/payments`}>Record Payment</Link></Button>
          )}
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p: Record<string, unknown>) => (
                <div key={p.id as string} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatINR(p.amount as number)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.payment_date as string).toLocaleDateString("en-IN")} &middot; <StatusBadge status={p.payment_mode as string} />
                    </p>
                  </div>
                  {(p.reference_number as string) && <span className="text-xs font-mono text-muted-foreground">{String(p.reference_number)}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Sales Receipt — shown only for is_sales_receipt invoices */}
      {invoice.is_sales_receipt && (
        <PrintSalesReceipt
          invoice={invoice}
          payment={payments[0] ?? null}
          company={company}
          branch={branch}
        />
      )}

      {/* Delivery Challan */}
      <DeliveryChallanSection
        invoice={invoice}
        company={company}
        branch={branch}
        currentUserId={user.id}
        companyId={invoice.company_id}
        canIssue={permissions.has(PERMISSIONS.INVOICE_ALLOW_DELIVERY)}
      />

      {/* Actions */}
      <div className="flex gap-3">
        {invoice.approval_status === "pending" && permissions.has(PERMISSIONS.INVOICE_CREATE) && (
          <Button asChild variant="outline"><Link href={`/invoices/${invoiceId}/edit`}>Edit</Link></Button>
        )}
        <Button asChild variant="outline"><Link href="/invoices">Back to Invoices</Link></Button>
      </div>
    </div>
  );
}
