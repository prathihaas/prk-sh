import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getInvoice } from "@/lib/queries/invoices";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { InvoicePaymentForm } from "@/components/forms/invoice-payment-form";

export default async function InvoicePaymentPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.INVOICE_CREATE)) redirect("/dashboard");

  let invoice;
  try {
    invoice = await getInvoice(invoiceId);
  } catch {
    notFound();
  }

  if (invoice.balance_due <= 0) redirect(`/invoices/${invoiceId}`);

  return (
    <div className="space-y-6">
      <InvoicePaymentForm
        invoiceId={invoiceId}
        currentUserId={user.id}
        balanceDue={invoice.balance_due}
      />
    </div>
  );
}
