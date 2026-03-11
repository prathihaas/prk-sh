import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getExpenseCategories } from "@/lib/queries/expense-categories";
import { ExpenseForm } from "@/components/forms/expense-form";

export default async function NewExpensePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.EXPENSE_SUBMIT)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId || !branchId) redirect("/expenses");

  const { data: fy } = await supabase
    .from("financial_years")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .single();

  if (!fy) redirect("/expenses");

  const allCategories = await getExpenseCategories(companyId);
  const categories = allCategories.filter((c: Record<string, unknown>) => c.is_active);

  return (
    <div className="space-y-6">
      <ExpenseForm
        companyId={companyId}
        branchId={branchId}
        currentUserId={user.id}
        financialYearId={fy.id}
        categories={categories}
      />
    </div>
  );
}
