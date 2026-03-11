import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCompany } from "@/lib/queries/companies";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CompanyForm } from "@/components/forms/company-form";
import { CompanyLogoUpload } from "@/components/shared/company-logo-upload";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) {
    redirect("/dashboard");
  }

  // Fetch company including logo_url
  let company: {
    id: string; name: string; code: string; legal_name: string | null;
    gstin: string | null; pan: string | null; address: Record<string, string> | null;
    logo_url: string | null; is_active: boolean; group_id: string;
  };
  try {
    const raw = await getCompany(companyId);
    company = raw as typeof company;
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Company"
        description={`Editing ${company.name}`}
      />
      {/* Logo Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Branding</CardTitle>
          <CardDescription>
            Upload your company logo — it will appear on printed receipts and expense vouchers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyLogoUpload
            companyId={company.id}
            currentLogoUrl={company.logo_url}
            companyName={company.name}
          />
        </CardContent>
      </Card>

      {/* Company Details Form */}
      <CompanyForm groupId={company.group_id} company={company} />
    </div>
  );
}
