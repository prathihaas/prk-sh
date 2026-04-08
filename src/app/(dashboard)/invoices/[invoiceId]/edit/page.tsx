import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getInvoice } from "@/lib/queries/invoices";
import { getCustomersForSelect } from "@/lib/queries/customers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getCurrentFinancialYear } from "@/lib/queries/financial-years";
import { InvoiceForm } from "@/components/forms/invoice-form";

export default async function EditInvoicePage({
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

  if (invoice.approval_status !== "pending") redirect(`/invoices/${invoiceId}`);

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId || !branchId) redirect("/invoices");

  const [fy, customers] = await Promise.all([
    getCurrentFinancialYear(companyId),
    getCustomersForSelect(companyId),
  ]);

  if (!fy) redirect("/invoices");

  return (
    <div className="space-y-6">
      <InvoiceForm
        companyId={companyId}
        branchId={branchId}
        currentUserId={user.id}
        financialYearId={fy.id}
        customers={customers}
        invoice={invoice}
      />
    </div>
  );
}
