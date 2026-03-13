import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getAssetCategories } from "@/lib/queries/assets";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AssetForm } from "../asset-form";

export default async function NewAssetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ASSET_CREATE)) redirect("/assets");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  if (!companyId) redirect("/assets");

  const [categories, branchesRes] = await Promise.all([
    getAssetCategories(companyId),
    supabase.from("branches").select("id, name, code").eq("company_id", companyId).eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <AssetForm
        companyId={companyId}
        userId={user.id}
        categories={categories as { id: string; name: string }[]}
        branches={(branchesRes.data || []) as { id: string; name: string; code: string }[]}
      />
    </div>
  );
}
