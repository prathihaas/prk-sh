import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ExcelImport } from "./excel-import";
import { getCashbooks } from "@/lib/queries/cashbooks";
import { getExpenseCategories } from "@/lib/queries/expense-categories";

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Excel Import"
          description="Select a company from the header first"
        />
      </div>
    );
  }

  // Get active financial year
  const { data: fy } = await supabase
    .from("financial_years")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .single();

  const cashbooks = await getCashbooks(companyId, branchId);
  const expenseCategories = await getExpenseCategories(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Excel Import"
        description="Bulk import data from Excel / CSV files into any module"
      />
      <ExcelImport
        companyId={companyId}
        branchId={branchId || ""}
        financialYearId={fy?.id || ""}
        currentUserId={user.id}
        cashbooks={cashbooks}
        expenseCategories={expenseCategories}
      />
    </div>
  );
}
