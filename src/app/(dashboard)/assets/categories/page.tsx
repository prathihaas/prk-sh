import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { getAssetCategories, createAssetCategory } from "@/lib/queries/assets";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { AssetCategoryManager } from "./category-manager";

export default async function AssetCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ASSET_CREATE)) redirect("/assets");

  const cookieStore = await cookies();
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );
  if (!companyId) redirect("/assets");

  const categories = await getAssetCategories(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Categories"
        description="Manage categories for classifying assets"
        action={{ label: "All Assets", href: "/assets" }}
      />
      <AssetCategoryManager
        categories={categories as { id: string; name: string; description: string | null; is_active: boolean }[]}
        companyId={companyId}
      />
    </div>
  );
}
