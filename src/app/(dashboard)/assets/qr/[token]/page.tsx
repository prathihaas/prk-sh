import { redirect, notFound } from "next/navigation";
import { getAssetByQrToken } from "@/lib/queries/assets";

export default async function AssetQrScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const asset = await getAssetByQrToken(token);
  if (!asset) notFound();
  redirect(`/assets/${asset.id}`);
}
