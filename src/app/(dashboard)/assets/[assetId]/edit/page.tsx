import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getAsset, getAssetCategories } from "@/lib/queries/assets";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { AssetForm } from "../../asset-form";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ASSET_UPDATE)) redirect(`/assets/${assetId}`);

  let asset: any;
  try { asset = await getAsset(assetId); } catch { notFound(); }
  if (!asset) notFound();

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value || asset.company_id;

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
        asset={asset}
      />
    </div>
  );
}
