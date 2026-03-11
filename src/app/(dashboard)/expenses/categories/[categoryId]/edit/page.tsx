import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getExpenseCategory } from "@/lib/queries/expense-categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ExpenseCategoryForm } from "@/components/forms/expense-category-form";

export default async function EditExpenseCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  if (!companyId) redirect("/expenses/categories");

  let category;
  try {
    category = await getExpenseCategory(categoryId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ExpenseCategoryForm companyId={companyId} category={category} />
    </div>
  );
}
