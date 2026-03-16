import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  getVehicle,
  getVehicleComments,
  STATUS_LABELS,
  type VehicleStatus,
  type ShopType,
} from "@/lib/queries/vehicle-register";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Circle,
  ExternalLink,
  Wrench,
  Paintbrush,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { VehicleActions } from "./vehicle-actions";
import { JobComments } from "./job-comments";

type StageDef = {
  key: VehicleStatus;
  label: string;
  tsKey: string;
  bodyshopOnly?: boolean;
};

const ALL_STAGES: StageDef[] = [
  { key: "arrived", label: "Arrived", tsKey: "arrived_at" },
  { key: "ro_opened", label: "R/O Opened", tsKey: "ro_opened_at" },
  { key: "waiting_for_parts", label: "Waiting for Parts", tsKey: "arrived_at" },
  { key: "parts_received", label: "Parts Received", tsKey: "arrived_at" },
  { key: "insurance_approved", label: "Insurance Approved", tsKey: "insurance_approved_at", bodyshopOnly: true },
  { key: "work_in_progress", label: "Work in Progress", tsKey: "work_started_at" },
  { key: "work_done", label: "Work Done", tsKey: "work_done_at" },
  { key: "ready_for_delivery", label: "Ready for Delivery", tsKey: "ready_at" },
  { key: "gate_pass_issued", label: "Gate Pass Issued", tsKey: "gate_pass_issued_at" },
  { key: "delivered", label: "Delivered", tsKey: "delivered_at" },
];

const LEGACY_STAGES: StageDef[] = [
  { key: "arrived", label: "Arrived", tsKey: "arrived_at" },
  { key: "billed", label: "Billed", tsKey: "billed_at" },
  { key: "challan_issued", label: "Gate Pass Issued", tsKey: "challan_issued_at" },
  { key: "delivered", label: "Delivered", tsKey: "delivered_at" },
];

const STATUS_ORDER: VehicleStatus[] = [
  "arrived", "ro_opened", "waiting_for_parts", "parts_received",
  "insurance_approved", "work_in_progress", "work_done",
  "ready_for_delivery", "gate_pass_issued", "delivered",
  "billed", "challan_issued",
];

function VehicleStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    arrived: "bg-slate-100 text-slate-700 border-slate-200",
    ro_opened: "bg-blue-100 text-blue-700 border-blue-200",
    waiting_for_parts: "bg-yellow-100 text-yellow-700 border-yellow-200",
    parts_received: "bg-cyan-100 text-cyan-700 border-cyan-200",
    insurance_approved: "bg-indigo-100 text-indigo-700 border-indigo-200",
    work_in_progress: "bg-orange-100 text-orange-700 border-orange-200",
    work_done: "bg-teal-100 text-teal-700 border-teal-200",
    ready_for_delivery: "bg-emerald-100 text-emerald-700 border-emerald-200",
    gate_pass_issued: "bg-purple-100 text-purple-700 border-purple-200",
    challan_issued: "bg-purple-100 text-purple-700 border-purple-200",
    delivered: "bg-green-100 text-green-700 border-green-200",
    billed: "bg-orange-100 text-orange-700 border-orange-200",
  };
  const cls = cfg[status] || "bg-muted text-muted-foreground";
  const label = STATUS_LABELS[status as VehicleStatus] || status.replace(/_/g, " ");
  return <Badge variant="outline" className={`text-xs ${cls}`}>{label}</Badge>;
}

function fmtDate(ts: unknown) {
  if (!ts) return null;
  return new Date(String(ts)).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.VEHICLE_REGISTER_VIEW)) redirect("/dashboard");

  let vehicle: Record<string, unknown>;
  try {
    vehicle = await getVehicle(vehicleId);
  } catch {
    notFound();
  }

  const comments = await getVehicleComments(vehicleId).catch(() => []);
  const canManage = permissions.has(PERMISSIONS.VEHICLE_REGISTER_MANAGE);

  const shopType = (vehicle.shop_type as ShopType) || "workshop";
  const status = String(vehicle.status) as VehicleStatus;
  const currentStatusIdx = STATUS_ORDER.indexOf(status);

  const isLegacy = !vehicle.shop_type;
  const stages = isLegacy
    ? LEGACY_STAGES
    : ALL_STAGES.filter((s) => !s.bodyshopOnly || shopType === "bodyshop");

  const invoice = vehicle.invoice as Record<string, unknown> | null;
  const ShopIcon = shopType === "bodyshop" ? Paintbrush : Wrench;
  const shopLabel = shopType === "bodyshop" ? "Bodyshop" : "Workshop";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/vehicle-register">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${String(vehicle.model)}${vehicle.registration_number ? ` — ${String(vehicle.registration_number)}` : ""}`}
        description={`${shopLabel}${vehicle.customer_name ? ` • ${String(vehicle.customer_name)}` : ""}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Status card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShopIcon className="h-4 w-4" />
                {shopLabel} Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <VehicleStatusBadge status={status} />
              {vehicle.ro_number ? (
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">R/O Number</p>
                  <p className="text-sm font-mono font-semibold">{String(vehicle.ro_number)}</p>
                </div>
              ) : null}
              {vehicle.is_insurance_claim ? (
                <div className="flex items-center gap-1.5 text-indigo-600 text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Insurance Claim
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Actions */}
          {canManage && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <VehicleActions vehicle={vehicle} userId={user.id} />
              </CardContent>
            </Card>
          )}

          {/* Progress timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stages.map((stage, idx) => {
                const stageIdx = STATUS_ORDER.indexOf(stage.key);
                const done = stageIdx <= currentStatusIdx;
                const current = stage.key === status;
                const ts = current ? fmtDate(vehicle[stage.tsKey]) : null;

                return (
                  <div key={stage.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {done ? (
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 mt-0.5 ${current ? "text-primary" : "text-green-600"}`}
                        />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                      )}
                      {idx < stages.length - 1 && (
                        <div
                          className={`w-px flex-1 my-1 ${done ? "bg-green-600" : "bg-border"}`}
                          style={{ minHeight: 12 }}
                        />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className={`text-xs font-medium ${done ? "" : "text-muted-foreground"}`}>
                        {stage.label}
                      </p>
                      {ts && <p className="text-xs text-muted-foreground">{ts}</p>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Vehicle info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: "Model", value: vehicle.model },
                  { label: "Vehicle No.", value: vehicle.registration_number },
                  { label: "Customer", value: vehicle.customer_name },
                  { label: "Shop", value: shopLabel },
                  { label: "Arrived", value: fmtDate(vehicle.arrived_at) },
                ]
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.label}>
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-medium">{String(f.value)}</p>
                    </div>
                  ))}
              </div>
              {Boolean(vehicle.notes) && (
                <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {String(vehicle.notes)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked invoice */}
          {invoice && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Linked Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">
                    {String(invoice.dms_invoice_number || "Invoice")}
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/invoices/${invoice.id}`}>
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      View Invoice
                    </Link>
                  </Button>
                </div>
                {Boolean(invoice.delivery_challan_number) ? (
                  <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm">
                    <p className="font-medium text-green-800 dark:text-green-200">✓ Gate Pass Issued</p>
                    <p className="text-green-700 dark:text-green-300 text-xs">
                      No: {String(invoice.delivery_challan_number)}
                      {invoice.delivery_challan_date ? ` • ${String(invoice.delivery_challan_date)}` : ""}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Gate Pass Pending</p>
                    <p className="text-xs mt-0.5">Issue the gate pass from the invoice before delivery.</p>
                    <Button variant="outline" size="sm" className="mt-2 text-xs" asChild>
                      <Link href={`/invoices/${invoice.id}`}>Go to Invoice → Issue Gate Pass</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Daily Work Log
                {comments.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {comments.length} {comments.length === 1 ? "entry" : "entries"}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobComments
                vehicleId={vehicleId}
                userId={user.id}
                comments={
                  comments as Array<{
                    id: string;
                    comment: string;
                    created_at: string;
                    author?: { full_name?: string } | null;
                  }>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
