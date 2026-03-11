import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getExpenseCategories } from "@/lib/queries/expense-categories";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { columns } from "./columns";

export default async function ExpenseCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.EXPENSE_APPROVE_ACCOUNTS)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expense Categories" description="Select a company first" />
      </div>
    );
  }

  const categories = await getExpenseCategories(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Categories"
        description="Manage expense categories and budget limits"
        action={{ label: "Add Category", href: "/expenses/categories/new" }}
      />
      <DataTable columns={columns} data={categories} emptyMessage="No categories found" />
    </div>
  );
}
