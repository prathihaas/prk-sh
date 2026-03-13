import { redirect, notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getAsset, getAssetHistory } from "@/lib/queries/assets";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/components/shared/currency-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, Car, Package, Pencil } from "lucide-react";
import { AssetQrCode } from "../asset-qr-code";
import { KmReadingForm, AuditForm, AssignForm, StatusToggle } from "../asset-actions";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ASSET_VIEW)) redirect("/dashboard");

  let asset: any;
  try {
    asset = await getAsset(assetId);
  } catch {
    notFound();
  }
  if (!asset) notFound();

  const history = await getAssetHistory(assetId);

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;

  const employeesRes = await supabase
    .from("employees")
    .select("id, name, employee_code")
    .eq("company_id", companyId || asset.company_id)
    .eq("status", "active")
    .order("name");

  const headersList = await headers();
  const host = headersList.get("host") || "prk-sh.vercel.app";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const canUpdate = permissions.has(PERMISSIONS.ASSET_UPDATE);
  const canAudit = permissions.has(PERMISSIONS.ASSET_AUDIT);
  const canAssign = permissions.has(PERMISSIONS.ASSET_ASSIGN);

  const category = asset.category as { name: string } | null;
  const assignedEmployee = asset.assigned_employee as { id: string; name: string; employee_code?: string } | null;

  // Depreciation calc
  let bookValue: number | null = null;
  if (asset.purchase_value && asset.useful_life_years && asset.purchase_date) {
    const purchaseYear = new Date(asset.purchase_date).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - purchaseYear;
    const annualDep = (asset.purchase_value - (asset.salvage_value || 0)) / asset.useful_life_years;
    bookValue = Math.max(asset.salvage_value || 0, asset.purchase_value - annualDep * age);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assets"><ChevronLeft className="h-4 w-4 mr-1" /> All Assets</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {asset.is_vehicle
            ? <Car className="h-6 w-6 text-muted-foreground" />
            : <Package className="h-6 w-6 text-muted-foreground" />}
          <PageHeader
            title={asset.name}
            description={`Asset Code: ${asset.asset_code}${category ? ` · ${category.name}` : ""}`}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusToggle assetId={asset.id} currentStatus={asset.status} />
          {canUpdate && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/assets/${asset.id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit</Link>
            </Button>
          )}
          {canAudit && (
            <AuditForm assetId={asset.id} userId={user.id} isVehicle={asset.is_vehicle} />
          )}
          {asset.is_vehicle && canAudit && (
            <KmReadingForm assetId={asset.id} userId={user.id} currentKm={asset.current_km_reading} />
          )}
          {canAssign && (
            <AssignForm
              assetId={asset.id}
              userId={user.id}
              employees={employeesRes.data || []}
              currentAssigneeId={asset.assigned_to}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Asset Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div><dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={asset.status} /></dd></div>
                <div><dt className="text-muted-foreground">Assigned To</dt><dd>{assignedEmployee?.name || "Unassigned"}</dd></div>
                <div><dt className="text-muted-foreground">Purchase Date</dt><dd>{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString("en-IN") : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Purchase Value</dt><dd className="tabular-nums">{asset.purchase_value ? formatINR(asset.purchase_value) : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Salvage Value</dt><dd className="tabular-nums">{formatINR(asset.salvage_value || 0)}</dd></div>
                <div><dt className="text-muted-foreground">Useful Life</dt><dd>{asset.useful_life_years ? `${asset.useful_life_years} years` : "—"}</dd></div>
                {bookValue !== null && (
                  <div><dt className="text-muted-foreground">Est. Book Value</dt><dd className="tabular-nums font-semibold">{formatINR(bookValue)}</dd></div>
                )}
                {asset.is_vehicle && (
                  <div><dt className="text-muted-foreground">Current Km</dt>
                    <dd className="font-medium">{asset.current_km_reading != null ? `${asset.current_km_reading.toLocaleString("en-IN")} km` : "—"}</dd>
                  </div>
                )}
                <div><dt className="text-muted-foreground">Last Audit</dt><dd>{asset.last_audit_date ? new Date(asset.last_audit_date).toLocaleDateString("en-IN") : "Never"}</dd></div>
                {asset.audit_condition && (
                  <div><dt className="text-muted-foreground">Last Condition</dt><dd><Badge variant="outline">{asset.audit_condition.replace("_", " ")}</Badge></dd></div>
                )}
                {asset.description && (
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Description</dt><dd>{asset.description}</dd></div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Km Readings (vehicles only) */}
          {asset.is_vehicle && history.kmReadings.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Km Reading Log</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Km Reading</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.kmReadings.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.reading_date).toLocaleDateString("en-IN")}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {Number(r.km_reading).toLocaleString("en-IN")} km
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit History */}
          {history.audits.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Audit History</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Condition</TableHead>
                        {asset.is_vehicle && <TableHead className="text-right">Km</TableHead>}
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.audits.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>{new Date(a.audited_at).toLocaleDateString("en-IN")}</TableCell>
                          <TableCell><Badge variant="outline">{a.condition.replace("_", " ")}</Badge></TableCell>
                          {asset.is_vehicle && <TableCell className="text-right tabular-nums">{a.km_reading ? `${Number(a.km_reading).toLocaleString("en-IN")} km` : "—"}</TableCell>}
                          <TableCell className="text-muted-foreground">{a.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assignment History */}
          {history.assignments.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Assignment History</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Returned</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.assignments.map((a: any) => {
                        const emp = a.employee as { name: string; employee_code?: string } | null;
                        return (
                          <TableRow key={a.id}>
                            <TableCell>{emp?.name || "—"}{emp?.employee_code && <span className="ml-1 text-xs text-muted-foreground">({emp.employee_code})</span>}</TableCell>
                            <TableCell>{new Date(a.assigned_at).toLocaleDateString("en-IN")}</TableCell>
                            <TableCell>{a.returned_at ? new Date(a.returned_at).toLocaleDateString("en-IN") : <Badge variant="outline" className="text-green-600">In Use</Badge>}</TableCell>
                            <TableCell className="text-muted-foreground">{a.notes || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* QR Code panel */}
        <div>
          <Card>
            <CardHeader><CardTitle>QR Code</CardTitle></CardHeader>
            <CardContent>
              <AssetQrCode qrToken={asset.qr_token} assetCode={asset.asset_code} baseUrl={baseUrl} />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Scan to open this asset&apos;s page
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
