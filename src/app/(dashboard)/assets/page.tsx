import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getAssets } from "@/lib/queries/assets";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Package, Eye } from "lucide-react";

export default async function AssetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ASSET_VIEW)) redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  const branchId = cookieStore.get("scope_branch_id")?.value;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Asset Register" description="Select a company from the header" />
      </div>
    );
  }

  let assets: any[] = [];
  try {
    assets = await getAssets(companyId, branchId || null) as any[];
  } catch (err) {
    console.error("Failed to load assets:", err);
    return (
      <div className="space-y-6">
        <PageHeader title="Asset Register" description="Track and manage company assets" />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Error loading assets.</strong> Please refresh the page or contact support.
        </div>
      </div>
    );
  }

  const canCreate = permissions.has(PERMISSIONS.ASSET_CREATE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Register"
        description="Track and manage company assets with QR codes, km readings, and audit trails"
        action={canCreate ? { label: "New Asset", href: "/assets/new" } : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Assets</div>
          <div className="text-2xl font-bold">{assets.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {assets.filter((a) => a.status === "active").length}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Under Maintenance / Disposed</div>
          <div className="text-2xl font-bold text-orange-600">
            {assets.filter((a) => a.status !== "active").length}
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Last Audit</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No assets found. {canCreate && <Link href="/assets/new" className="underline">Add the first asset.</Link>}
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset: any) => {
                const category = asset.category as { name: string } | null;
                const employee = asset.assigned_employee as { name: string } | null;
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-sm font-medium">{asset.asset_code}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{category?.name || "—"}</TableCell>
                    <TableCell>
                      {asset.is_vehicle ? (
                        <Badge variant="outline" className="gap-1"><Car className="h-3 w-3" />Vehicle</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Package className="h-3 w-3" />Asset</Badge>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={asset.status} /></TableCell>
                    <TableCell>{employee?.name || <span className="text-muted-foreground text-xs">Unassigned</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {asset.purchase_value ? formatINR(asset.purchase_value) : "—"}
                    </TableCell>
                    <TableCell>
                      {asset.last_audit_date
                        ? new Date(asset.last_audit_date).toLocaleDateString("en-IN")
                        : <span className="text-muted-foreground text-xs">Never</span>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/assets/${asset.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
